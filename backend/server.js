require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { format } = require('date-fns');
const { toZonedTime } = require('date-fns-tz');

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Invalid file type'));
  }
});

const uploadDocs = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/jpg'
    ];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Invalid file type'));
  }
});

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Auth session missing!' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Auth session missing!' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.error('Auth error:', error);
      return res.status(401).json({ error: 'Auth session missing!' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ error: 'Auth session missing!' });
  }
};

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: 'Invalid credentials' });

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', data.user.id)
    .single();

  res.json({
    token: data.session.access_token,
    role: profile?.role || 'intern',
    name: profile?.full_name || data.user.email
  });
});

app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;

  // Use admin client to create user with auto-confirmation
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true // Auto-confirm email
  });

  if (error) return res.status(400).json({ error: error.message });

  if (data.user) {
    // Create profile for the new user
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: data.user.id,
        full_name: name,
        role: 'intern'
      });

    if (profileError) return res.status(500).json({ error: profileError.message });
  }

  res.json({ message: 'Account created successfully' });
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { token } = req.body;
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.error('Google auth error:', error);
      return res.status(401).json({ error: 'Invalid token' });
    }

    let { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single();

    if (!profile) {
      const { error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email,
          role: 'intern'
        });
      if (insertError) {
        console.error('Profile creation error:', insertError);
        return res.status(500).json({ error: insertError.message });
      }
      profile = { full_name: user.user_metadata?.full_name || user.email, role: 'intern' };
    }

    res.json({
      role: profile.role,
      name: profile.full_name
    });
  } catch (err) {
    console.error('Google auth exception:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.post('/api/attendance/checkin', auth, upload.single('photo'), async (req, res) => {
  try {
    const { time_in } = req.body;
    // Use Philippines timezone for date
    const phTime = toZonedTime(new Date(), 'Asia/Manila');
    const date = format(phTime, 'yyyy-MM-dd');

    // Allow up to 2 check-ins per day (morning + afternoon)
    const { data: existingCheckins, error: existingError } = await supabaseAdmin
      .from('attendance')
      .select('id, time_out')
      .eq('user_id', req.user.id)
      .eq('date', date);

    if (existingError) {
      console.error('Check existing attendance error:', existingError);
      return res.status(500).json({ error: existingError.message });
    }

    if (existingCheckins && existingCheckins.length >= 2) {
      return res.status(400).json({ error: 'You have reached the maximum of 2 check-ins today.' });
    }

    const openSameDay = existingCheckins?.find(c => !c.time_out);
    if (openSameDay) {
      return res.status(400).json({ error: 'Please check out your current session before checking in again.' });
    }

    // Convert AM/PM time to 24-hour for comparison and compute deductions
    const timeIn24 = convertTo24Hour(time_in);
    const [h, m] = timeIn24.split(':').map(v => parseInt(v, 10));
    const minutesSinceMidnight = h * 60 + m;

    // Morning window baseline: 08:05, late <=09:00 deduct 1hr, >=09:00 deduct 2hr
    // Afternoon window baseline: 13:00, late >5min (13:05) deduct 1hr
    const morningBaseline = 8 * 60 + 5;
    const morningLate = 9 * 60;
    const afternoonBaseline = 13 * 60; // 1:00 PM
    const afternoonLateThreshold = 13 * 60 + 5; // 1:05 PM

    const isMorning = minutesSinceMidnight < 12 * 60;
    let lateDeduction = 0;
    let lateMinutes = 0;
    let status = 'On-Time';

    if (isMorning) {
      if (minutesSinceMidnight > morningBaseline) {
        lateMinutes = minutesSinceMidnight - morningBaseline;
        status = 'Late';
        lateDeduction = minutesSinceMidnight >= morningLate ? 2 : 1;
      }
    } else {
      // Afternoon: late if after 1:05 PM, deduct 1 hour
      if (minutesSinceMidnight > afternoonLateThreshold) {
        lateMinutes = minutesSinceMidnight - afternoonBaseline;
        status = 'Late';
        lateDeduction = 1;
      }
    }

    let photoUrl = null;
    if (req.file) {
      const fileExt = req.file.originalname.split('.').pop();
      const fileName = `${req.user.id}/${uuidv4()}.${fileExt}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('checkinphoto')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        });

      if (uploadError) {
        console.error('Photo upload error:', uploadError);
        return res.status(500).json({ error: uploadError.message });
      }

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('checkinphoto')
        .getPublicUrl(fileName);

      photoUrl = publicUrl;
    }

    const { data, error } = await supabaseAdmin
      .from('attendance')
      .insert({
        user_id: req.user.id,
        date,
        time_in,
        status,
        photo_path: photoUrl,
        late_deduction_hours: lateDeduction
      })
      .select()
      .single();

    if (error) {
      console.error('Checkin error:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json({ id: data.id, status, lateMinutes, lateDeduction });
  } catch (err) {
    console.error('Checkin exception:', err);
    res.status(500).json({ error: err.message });
  }
});

function convertTo24Hour(time12h) {
  const [time, modifier] = time12h.split(' ');
  let [hours, minutes] = time.split(':');
  if (hours === '12') {
    hours = '00';
  }
  if (modifier === 'PM') {
    hours = parseInt(hours, 10) + 12;
  }
  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

app.put('/api/attendance/checkout/:id', auth, uploadDocs.array('attachments', 5), async (req, res) => {
  try {
    const { time_out, work_documentation } = req.body;
    console.log('Checkout request:', { id: req.params.id, time_out, work_documentation, user_id: req.user.id });

    const { data: entry, error: entryError } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (entryError || !entry) {
      return res.status(404).json({ error: 'Attendance entry not found.' });
    }

    let attachmentUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${req.user.id}/${uuidv4()}.${fileExt}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from('workdocs')
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false
          });

        if (uploadError) {
          console.error('File upload error:', uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabaseAdmin.storage
          .from('workdocs')
          .getPublicUrl(fileName);

        attachmentUrls.push(publicUrl);
      }
    }

    const updateData = { time_out, work_documentation };
    if (attachmentUrls.length > 0) {
      updateData.attachments = attachmentUrls;
    }

    const { error } = await supabaseAdmin
      .from('attendance')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) {
      console.error('Checkout error:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Checkout exception:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/attendance/overtime-in/:id', auth, async (req, res) => {
  // Use Philippines timezone for date
  const phTime = toZonedTime(new Date(), 'Asia/Manila');
  const today = format(phTime, 'yyyy-MM-dd');
  // Require afternoon checkout to be completed
  const { data: afternoon, error: afternoonError } = await supabaseAdmin
    .from('attendance')
    .select('*')
    .eq('user_id', req.user.id)
    .eq('date', today)
    .order('time_in', { ascending: false })
    .limit(1)
    .single();

  if (afternoonError || !afternoon || !afternoon.time_out) {
    return res.status(400).json({ error: 'Complete afternoon checkout before starting overtime.' });
  }

  const phTime2 = toZonedTime(new Date(), 'Asia/Manila');
  const otTimeIn = format(phTime2, 'hh:mm a');
  const { error } = await supabaseAdmin
    .from('attendance')
    .update({ ot_time_in: otTimeIn })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.put('/api/attendance/overtime-out/:id', auth, async (req, res) => {
  const phTime = toZonedTime(new Date(), 'Asia/Manila');
  const otTimeOut = format(phTime, 'hh:mm a');
  const { error } = await supabaseAdmin
    .from('attendance')
    .update({ ot_time_out: otTimeOut })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.get('/api/interns', auth, async (req, res) => {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', req.user.id)
    .single();

  if (profile?.role !== 'coordinator')
    return res.status(403).json({ error: 'Access denied' });

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, profile_picture, is_leader')
    .eq('role', 'intern')
    .order('full_name');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/attendance/my', auth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('attendance')
    .select('*')
    .eq('user_id', req.user.id)
    .order('date', { ascending: false })
    .order('time_in', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/attendance/all', auth, async (req, res) => {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', req.user.id)
    .single();

  if (profile?.role !== 'coordinator')
    return res.status(403).json({ error: 'Access denied' });

  const { data, error } = await supabaseAdmin
    .from('attendance')
    .select(`
      *,
      profiles!attendance_user_id_fkey(full_name)
    `)
    .order('date', { ascending: false })
    .order('time_in', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const formatted = data.map(a => ({
    ...a,
    full_name: a.profiles?.full_name
  }));

  res.json(formatted);
});

app.get('/api/profile', auth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      console.error('Profile fetch error:', error);
      return res.status(500).json({ error: error.message });
    }
    res.json({ ...data, email: req.user.email });
  } catch (err) {
    console.error('Profile fetch exception:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/profile', auth, async (req, res) => {
  const { full_name } = req.body;
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ full_name })
    .eq('id', req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.put('/api/profile/password', auth, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Use admin client to update user password
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      req.user.id,
      { password }
    );

    if (error) {
      console.error('Password update error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Password update exception:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/profile/picture', auth, upload.single('profile_pic'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    console.log('Profile pic upload:', { userId: req.user.id, fileName: req.file.originalname });

    const fileExt = req.file.originalname.split('.').pop();
    const fileName = `${req.user.id}/profile.${fileExt}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('profilepicture')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return res.status(500).json({ error: uploadError.message });
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('profilepicture')
      .getPublicUrl(fileName);

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ profile_picture: publicUrl })
      .eq('id', req.user.id);

    if (error) {
      console.error('Database update error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('Profile picture uploaded successfully:', publicUrl);
    res.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error('Profile picture upload exception:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 5MB limit' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ====== GROUP MANAGEMENT ENDPOINTS ======

// Get all groups (for coordinators/leaders)
app.get('/api/groups', auth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, is_leader')
      .eq('id', req.user.id)
      .single();

    let query = supabaseAdmin
      .from('groups')
      .select(`
        *,
        leader:profiles!groups_leader_id_fkey(id, full_name),
        members:group_members(
          user:profiles(id, full_name)
        )
      `);

    // If not coordinator, only show groups where user is leader or member
    if (profile?.role !== 'coordinator') {
      const { data: membership } = await supabaseAdmin
        .from('group_members')
        .select('group_id')
        .eq('user_id', req.user.id)
        .single();

      const { data: leaderGroups } = await supabaseAdmin
        .from('groups')
        .select('id')
        .eq('leader_id', req.user.id);

      const groupIds = [
        ...(membership ? [membership.group_id] : []),
        ...(leaderGroups?.map(g => g.id) || [])
      ];

      if (groupIds.length === 0) {
        return res.json([]);
      }
      query = query.in('id', groupIds);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new group (coordinators or leaders only)
app.post('/api/groups', auth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, is_leader')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'coordinator' && !profile?.is_leader) {
      return res.status(403).json({ error: 'Only coordinators or leaders can create groups' });
    }

    const { name, description, leader_id } = req.body;
    const { data, error } = await supabaseAdmin
      .from('groups')
      .insert({
        name,
        description,
        leader_id: leader_id || req.user.id,
        created_by: req.user.id
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update group
app.put('/api/groups/:id', auth, async (req, res) => {
  try {
    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('leader_id')
      .eq('id', req.params.id)
      .single();

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'coordinator' && group?.leader_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, description, leader_id } = req.body;
    const { error } = await supabaseAdmin
      .from('groups')
      .update({ name, description, leader_id })
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete group (coordinators or group leader)
app.delete('/api/groups/:id', auth, async (req, res) => {
  try {
    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('leader_id')
      .eq('id', req.params.id)
      .single();

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    const isCoordinator = profile?.role === 'coordinator';
    const isGroupLeader = group?.leader_id === req.user.id;

    if (!isCoordinator && !isGroupLeader) {
      return res.status(403).json({ error: 'Only coordinators or group leaders can delete groups' });
    }

    const { error } = await supabaseAdmin
      .from('groups')
      .delete()
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add member to group
app.post('/api/groups/:id/members', auth, async (req, res) => {
  try {
    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('leader_id')
      .eq('id', req.params.id)
      .single();

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'coordinator' && group?.leader_id !== req.user.id) {
      return res.status(403).json({ error: 'Only leaders or coordinators can add members' });
    }

    const { user_id } = req.body;

    // Check if user is already in a group
    const { data: existingMembership } = await supabaseAdmin
      .from('group_members')
      .select('group_id')
      .eq('user_id', user_id)
      .single();

    if (existingMembership) {
      return res.status(400).json({ error: 'User is already a member of another group' });
    }

    const { data, error } = await supabaseAdmin
      .from('group_members')
      .insert({ group_id: req.params.id, user_id })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove member from group
app.delete('/api/groups/:id/members/:userId', auth, async (req, res) => {
  try {
    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('leader_id')
      .eq('id', req.params.id)
      .single();

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'coordinator' && group?.leader_id !== req.user.id) {
      return res.status(403).json({ error: 'Only leaders or coordinators can remove members' });
    }

    const { error } = await supabaseAdmin
      .from('group_members')
      .delete()
      .eq('group_id', req.params.id)
      .eq('user_id', req.params.userId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get available users (not in any group) - for adding to groups
app.get('/api/users/available', auth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, is_leader')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'coordinator' && !profile?.is_leader) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all interns not in any group
    const { data: allInterns } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, is_leader')
      .eq('role', 'intern');

    const { data: groupMembers } = await supabaseAdmin
      .from('group_members')
      .select('user_id');

    const memberIds = groupMembers?.map(m => m.user_id) || [];
    const availableUsers = allInterns?.filter(u => !memberIds.includes(u.id)) || [];

    res.json(availableUsers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign leader role to an intern (coordinators only)
app.post('/api/users/:userId/make-leader', auth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'coordinator') {
      return res.status(403).json({ error: 'Only coordinators can assign leaders' });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ is_leader: true })
      .eq('id', req.params.userId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove leader role from an intern (coordinators only)
app.post('/api/users/:userId/remove-leader', auth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'coordinator') {
      return res.status(403).json({ error: 'Only coordinators can remove leaders' });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ is_leader: false })
      .eq('id', req.params.userId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all interns (for coordinators to assign leaders)
app.get('/api/users/interns', auth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'coordinator') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, is_leader')
      .eq('role', 'intern')
      .order('full_name');

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== TODO ENDPOINTS ======

// Get all todos (filtered by type)
app.get('/api/todos', auth, async (req, res) => {
  try {
    const { type } = req.query;
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, is_leader')
      .eq('id', req.user.id)
      .single();

    // Get user's group membership
    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('group_id')
      .eq('user_id', req.user.id)
      .single();

    // Get groups where user is leader
    const { data: leaderGroups } = await supabaseAdmin
      .from('groups')
      .select('id')
      .eq('leader_id', req.user.id);

    const leaderGroupIds = leaderGroups?.map(g => g.id) || [];

    let query = supabaseAdmin
      .from('todos')
      .select(`
        *,
        creator:profiles!todos_user_id_fkey(id, full_name),
        assignee:profiles!todos_assigned_to_fkey(id, full_name),
        assigner:profiles!todos_assigned_by_fkey(id, full_name),
        suggester:profiles!todos_suggested_by_fkey(id, full_name),
        group:groups(id, name)
      `);

    if (type) {
      if (type === 'personal') {
        query = query.eq('todo_type', 'personal').eq('user_id', req.user.id);
      } else if (type === 'group') {
        // GROUP TAB (Leaders only): Show pending suggestions + pending completions
        // Only accessible to leaders
        if (!profile?.is_leader && leaderGroupIds.length === 0) {
          return res.json([]);
        }

        const groupIds = leaderGroupIds;
        if (groupIds.length === 0) {
          return res.json([]);
        }

        // Get unconfirmed group todos (pending suggestions)
        const { data: pendingSuggestions, error: suggestError } = await supabaseAdmin
          .from('todos')
          .select(`
            *,
            creator:profiles!todos_user_id_fkey(id, full_name),
            assignee:profiles!todos_assigned_to_fkey(id, full_name),
            assigner:profiles!todos_assigned_by_fkey(id, full_name),
            suggester:profiles!todos_suggested_by_fkey(id, full_name),
            group:groups(id, name)
          `)
          .eq('todo_type', 'group')
          .in('group_id', groupIds)
          .eq('is_confirmed', false)
          .order('created_at', { ascending: false });

        if (suggestError) return res.status(500).json({ error: suggestError.message });

        // Get pending completion todos (awaiting leader approval)
        const { data: pendingCompletion, error: pendingError } = await supabaseAdmin
          .from('todos')
          .select(`
            *,
            creator:profiles!todos_user_id_fkey(id, full_name),
            assignee:profiles!todos_assigned_to_fkey(id, full_name),
            assigner:profiles!todos_assigned_by_fkey(id, full_name),
            suggester:profiles!todos_suggested_by_fkey(id, full_name),
            group:groups(id, name)
          `)
          .eq('todo_type', 'group')
          .in('group_id', groupIds)
          .eq('pending_completion', true)
          .eq('completed', false)
          .order('created_at', { ascending: false });

        if (pendingError) return res.status(500).json({ error: pendingError.message });

        // Also get assigned tasks with pending completion for this group's members
        const { data: groupMembers } = await supabaseAdmin
          .from('group_members')
          .select('user_id')
          .in('group_id', groupIds);

        // Include the leader (req.user.id) in the member list
        const memberIds = [...(groupMembers?.map(m => m.user_id) || []), req.user.id];
        let assignedPending = [];
        let allAssignedTasks = [];

        if (memberIds.length > 0) {
          // Get pending completion assigned tasks
          const { data: assigned, error: assignedError } = await supabaseAdmin
            .from('todos')
            .select(`
              *,
              creator:profiles!todos_user_id_fkey(id, full_name),
              assignee:profiles!todos_assigned_to_fkey(id, full_name),
              assigner:profiles!todos_assigned_by_fkey(id, full_name),
              suggester:profiles!todos_suggested_by_fkey(id, full_name),
              group:groups(id, name)
            `)
            .eq('todo_type', 'assigned')
            .in('assigned_to', memberIds)
            .eq('pending_completion', true)
            .eq('completed', false)
            .order('created_at', { ascending: false });

          if (!assignedError && assigned) {
            assignedPending = assigned;
          }

          // Also get ALL assigned tasks (for member stats calculation)
          const { data: allAssigned } = await supabaseAdmin
            .from('todos')
            .select(`
              *,
              creator:profiles!todos_user_id_fkey(id, full_name),
              assignee:profiles!todos_assigned_to_fkey(id, full_name),
              assigner:profiles!todos_assigned_by_fkey(id, full_name),
              suggester:profiles!todos_suggested_by_fkey(id, full_name),
              group:groups(id, name)
            `)
            .eq('todo_type', 'assigned')
            .in('assigned_to', memberIds)
            .eq('assigned_by', req.user.id)
            .order('created_at', { ascending: false });

          if (allAssigned) {
            allAssignedTasks = allAssigned;
          }
        }

        // Combine: pending suggestions + pending completions + all assigned tasks (for stats)
        // Note: allAssignedTasks may have duplicates with assignedPending, frontend will dedupe
        const allTodos = [...(pendingSuggestions || []), ...(pendingCompletion || []), ...assignedPending, ...allAssignedTasks]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Remove duplicates by id
        const uniqueTodos = [...new Map(allTodos.map(item => [item.id, item])).values()];

        return res.json(uniqueTodos);
      } else if (type === 'team') {
        // TEAM TAB (All members): Show confirmed ongoing + completed tasks
        const groupIds = [...(membership ? [membership.group_id] : []), ...leaderGroupIds];

        if (groupIds.length === 0) {
          return res.json([]);
        }

        // Get confirmed group todos (ongoing and completed)
        const { data: confirmedTodos, error: confirmedError } = await supabaseAdmin
          .from('todos')
          .select(`
            *,
            creator:profiles!todos_user_id_fkey(id, full_name),
            assignee:profiles!todos_assigned_to_fkey(id, full_name),
            assigner:profiles!todos_assigned_by_fkey(id, full_name),
            suggester:profiles!todos_suggested_by_fkey(id, full_name),
            group:groups(id, name)
          `)
          .eq('todo_type', 'group')
          .in('group_id', groupIds)
          .eq('is_confirmed', true)
          .order('created_at', { ascending: false });

        if (confirmedError) return res.status(500).json({ error: confirmedError.message });

        // Get assigned tasks for group members
        const { data: groupMembers } = await supabaseAdmin
          .from('group_members')
          .select('user_id')
          .in('group_id', groupIds);

        // Fetch leaders for these groups to include them
        const { data: groupsData } = await supabaseAdmin
          .from('groups')
          .select('leader_id')
          .in('id', groupIds);

        const groupLeaderIds = groupsData?.map(g => g.leader_id) || [];

        const memberIds = [
          ...(groupMembers?.map(m => m.user_id) || []),
          ...groupLeaderIds
        ];

        let assignedTodos = [];
        if (memberIds.length > 0) {
          const { data: assigned, error: assignedError } = await supabaseAdmin
            .from('todos')
            .select(`
              *,
              creator:profiles!todos_user_id_fkey(id, full_name),
              assignee:profiles!todos_assigned_to_fkey(id, full_name),
              assigner:profiles!todos_assigned_by_fkey(id, full_name),
              suggester:profiles!todos_suggested_by_fkey(id, full_name),
              group:groups(id, name)
            `)
            .eq('todo_type', 'assigned')
            .in('assigned_to', memberIds)
            .order('created_at', { ascending: false });

          if (!assignedError && assigned) {
            assignedTodos = assigned;
          }
        }

        // Combine and sort
        const allTodos = [...(confirmedTodos || []), ...assignedTodos]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return res.json(allTodos);
      } else if (type === 'assigned') {
        // Show assigned todos + confirmed group todos for user's groups
        const groupIds = [...(membership ? [membership.group_id] : []), ...leaderGroupIds];

        // We need to fetch both assigned todos and confirmed group todos
        // First get assigned todos
        const { data: assignedTodos, error: assignedError } = await supabaseAdmin
          .from('todos')
          .select(`
            *,
            creator:profiles!todos_user_id_fkey(id, full_name),
            assignee:profiles!todos_assigned_to_fkey(id, full_name),
            assigner:profiles!todos_assigned_by_fkey(id, full_name),
            suggester:profiles!todos_suggested_by_fkey(id, full_name),
            group:groups(id, name)
          `)
          .eq('todo_type', 'assigned')
          .or(`assigned_to.eq.${req.user.id},assigned_by.eq.${req.user.id}`)
          .order('created_at', { ascending: false });

        if (assignedError) return res.status(500).json({ error: assignedError.message });

        // Then get confirmed group todos if user is in a group
        let confirmedGroupTodos = [];
        if (groupIds.length > 0) {
          const { data: groupTodos, error: groupError } = await supabaseAdmin
            .from('todos')
            .select(`
              *,
              creator:profiles!todos_user_id_fkey(id, full_name),
              assignee:profiles!todos_assigned_to_fkey(id, full_name),
              assigner:profiles!todos_assigned_by_fkey(id, full_name),
              suggester:profiles!todos_suggested_by_fkey(id, full_name),
              group:groups(id, name)
            `)
            .eq('todo_type', 'group')
            .eq('is_confirmed', true)
            .in('group_id', groupIds)
            .order('created_at', { ascending: false });

          if (groupError) return res.status(500).json({ error: groupError.message });
          confirmedGroupTodos = groupTodos || [];
        }

        // Combine and sort by created_at
        const allTodos = [...(assignedTodos || []), ...confirmedGroupTodos]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return res.json(allTodos);
      } else if (type === 'global') {
        // Global tab shows: global todos + confirmed group todos (not completed) + assigned tasks (not completed)
        // Exclude: personal, unconfirmed group, completed tasks
        query = query.or('todo_type.eq.global,and(todo_type.eq.group,is_confirmed.eq.true,completed.eq.false),and(todo_type.eq.assigned,completed.eq.false)');
      }
    } else {
      // No type filter - get all accessible todos
      // Build OR conditions for accessible todos
      const orConditions = [
        `todo_type.eq.personal,user_id.eq.${req.user.id}`,
        'todo_type.eq.global'
      ];

      if (membership || leaderGroupIds.length > 0) {
        const groupIds = [...(membership ? [membership.group_id] : []), ...leaderGroupIds];
        orConditions.push(`todo_type.eq.group,group_id.in.(${groupIds.join(',')})`);
      }

      orConditions.push(`todo_type.eq.assigned,assigned_to.eq.${req.user.id}`);
      orConditions.push(`todo_type.eq.assigned,assigned_by.eq.${req.user.id}`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create todo
app.post('/api/todos', auth, async (req, res) => {
  try {
    const { task, todo_type = 'personal', group_id, assigned_to, start_date, deadline } = req.body;
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, is_leader')
      .eq('id', req.user.id)
      .single();

    const todoData = {
      user_id: req.user.id,
      task,
      todo_type,
      is_confirmed: true // Default to confirmed for personal todos
    };

    // Handle different todo types
    if (todo_type === 'global') {
      // Only coordinators can create global todos
      if (profile?.role !== 'coordinator') {
        return res.status(403).json({ error: 'Only coordinators can create global todos' });
      }
    } else if (todo_type === 'group') {
      // Anyone in the group can suggest, but needs leader confirmation
      if (!group_id) {
        return res.status(400).json({ error: 'Group ID is required for group todos' });
      }

      // Check if user is member or leader of this group
      const { data: group } = await supabaseAdmin
        .from('groups')
        .select('leader_id')
        .eq('id', group_id)
        .single();

      const isLeader = group?.leader_id === req.user.id;

      const { data: membership } = await supabaseAdmin
        .from('group_members')
        .select('id')
        .eq('group_id', group_id)
        .eq('user_id', req.user.id)
        .single();

      if (!isLeader && !membership) {
        return res.status(403).json({ error: 'You must be a member of this group' });
      }

      todoData.group_id = group_id;
      todoData.suggested_by = req.user.id;
      todoData.is_confirmed = isLeader; // Auto-confirm if created by leader
    } else if (todo_type === 'assigned') {
      // Only leaders or coordinators can assign tasks
      const isCoordinator = profile?.role === 'coordinator';
      const isLeaderProfile = profile?.is_leader === true;

      if (!isCoordinator && !isLeaderProfile) {
        return res.status(403).json({ error: 'Only leaders or coordinators can assign tasks' });
      }
      if (!assigned_to) {
        return res.status(400).json({ error: 'Assignee is required for assigned todos' });
      }

      // Leaders can always assign to themselves, otherwise check group membership
      const isSelfAssign = String(assigned_to) === String(req.user.id);

      if (isLeaderProfile && !isCoordinator && !isSelfAssign) {
        // Only check group membership if assigning to someone else
        const { data: leaderGroups } = await supabaseAdmin
          .from('groups')
          .select('id')
          .eq('leader_id', req.user.id);

        const leaderGroupIds = leaderGroups?.map(g => g.id) || [];

        const { data: assigneeMembership } = await supabaseAdmin
          .from('group_members')
          .select('group_id')
          .eq('user_id', assigned_to)
          .single();

        if (!assigneeMembership || !leaderGroupIds.includes(assigneeMembership.group_id)) {
          return res.status(403).json({ error: 'You can only assign tasks to members of your group' });
        }
      }

      todoData.assigned_to = assigned_to;
      todoData.assigned_by = req.user.id;
      todoData.is_confirmed = true;
      todoData.date_assigned = new Date().toISOString();

      // Add start_date and deadline if provided
      if (start_date) todoData.start_date = start_date;
      if (deadline) todoData.deadline = deadline;
    }

    const { data, error } = await supabaseAdmin
      .from('todos')
      .insert(todoData)
      .select(`
        *,
        creator:profiles!todos_user_id_fkey(id, full_name),
        assignee:profiles!todos_assigned_to_fkey(id, full_name),
        assigner:profiles!todos_assigned_by_fkey(id, full_name),
        group:groups(id, name)
      `)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update todo (mark complete, edit task)
app.put('/api/todos/:id', auth, async (req, res) => {
  try {
    const { completed, task, is_confirmed } = req.body;
    const { data: todo } = await supabaseAdmin
      .from('todos')
      .select('*, group:groups(leader_id)')
      .eq('id', req.params.id)
      .single();

    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, is_leader')
      .eq('id', req.user.id)
      .single();

    const isCoordinator = profile?.role === 'coordinator';
    const isOwner = todo.user_id === req.user.id;
    const isGroupLeader = todo.group?.leader_id === req.user.id;
    const isAssigner = todo.assigned_by === req.user.id;
    const isAssignee = todo.assigned_to === req.user.id;

    // Check permissions based on todo type
    let canUpdate = false;
    let updateData = {};

    if (todo.todo_type === 'personal') {
      canUpdate = isOwner;
      if (canUpdate) updateData = { completed, task };
    } else if (todo.todo_type === 'global') {
      canUpdate = isCoordinator;
      if (canUpdate) updateData = { completed, task };
    } else if (todo.todo_type === 'group') {
      // Check if user is a member of this group
      const { data: membership } = await supabaseAdmin
        .from('group_members')
        .select('id')
        .eq('group_id', todo.group_id)
        .eq('user_id', req.user.id)
        .single();

      const isGroupMember = !!membership;

      if (isGroupLeader || isCoordinator) {
        // Leaders can directly complete/edit group todos
        canUpdate = true;
        updateData = { completed, task, is_confirmed, pending_completion: false };
      } else if (isGroupMember && todo.is_confirmed) {
        // Group members can request completion for confirmed group todos
        canUpdate = true;
        if (completed === true && !todo.completed) {
          // Member requests completion - needs leader approval
          updateData = { pending_completion: true };
        } else if (completed === false) {
          // Member can uncheck pending_completion
          updateData = { pending_completion: false };
        }
      }
    } else if (todo.todo_type === 'assigned') {
      // Self-assigned tasks (leader assigned to themselves) can be completed directly
      const isSelfAssigned = todo.assigned_to === todo.assigned_by;

      if (isSelfAssigned && isAssignee) {
        // Leader completing their own self-assigned task - no approval needed
        canUpdate = true;
        updateData = { completed, task, pending_completion: false };
      } else if (isAssignee && !isAssigner && !isCoordinator) {
        canUpdate = true;
        // If assignee tries to mark complete, set pending_completion instead
        if (completed === true && !todo.completed) {
          updateData = { pending_completion: true };
        } else if (completed === false) {
          // Assignee can uncheck pending_completion
          updateData = { pending_completion: false };
        }
      } else if (isAssigner || isCoordinator) {
        canUpdate = true;
        updateData = { completed, task, pending_completion: false };
      }
    }

    if (!canUpdate) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    const { error } = await supabaseAdmin
      .from('todos')
      .update(updateData)
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Confirm group todo (leaders only) - with assignment details
app.post('/api/todos/:id/confirm', auth, async (req, res) => {
  try {
    const { start_date, deadline, assigned_to, task } = req.body;

    const { data: todo } = await supabaseAdmin
      .from('todos')
      .select('*, group:groups(leader_id)')
      .eq('id', req.params.id)
      .single();

    if (!todo || todo.todo_type !== 'group') {
      return res.status(404).json({ error: 'Group todo not found' });
    }

    if (todo.group?.leader_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the group leader can confirm todos' });
    }

    // Build update data
    const updateData = {
      is_confirmed: true,
      date_assigned: new Date().toISOString()
    };

    // Optional fields that leader can set/modify
    if (start_date) updateData.start_date = start_date;
    if (deadline) updateData.deadline = deadline;
    if (task) updateData.task = task;

    // If assigning to someone, change todo_type to 'assigned' and set assigned_to/assigned_by
    if (assigned_to) {
      updateData.todo_type = 'assigned';
      updateData.assigned_to = assigned_to;
      updateData.assigned_by = req.user.id;
      // Clear group_id since it's now an assigned task (to avoid constraint violation)
      updateData.group_id = null;
    }

    const { error } = await supabaseAdmin
      .from('todos')
      .update(updateData)
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Confirm completion of assigned or group task (leader/assigner only)
app.post('/api/todos/:id/confirm-completion', auth, async (req, res) => {
  try {
    const { data: todo } = await supabaseAdmin
      .from('todos')
      .select('*, group:groups(leader_id)')
      .eq('id', req.params.id)
      .single();

    if (!todo || (todo.todo_type !== 'assigned' && todo.todo_type !== 'group')) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    if (!todo.pending_completion) {
      return res.status(400).json({ error: 'This task is not pending completion' });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    const isCoordinator = profile?.role === 'coordinator';
    const isAssigner = todo.assigned_by === req.user.id;
    const isGroupLeader = todo.group?.leader_id === req.user.id;

    // For assigned todos: assigner or coordinator can confirm
    // For group todos: group leader or coordinator can confirm
    const canConfirm = isCoordinator ||
      (todo.todo_type === 'assigned' && isAssigner) ||
      (todo.todo_type === 'group' && isGroupLeader);

    if (!canConfirm) {
      return res.status(403).json({ error: 'Only the leader or coordinator can confirm completion' });
    }

    const { error } = await supabaseAdmin
      .from('todos')
      .update({ completed: true, pending_completion: false })
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reject completion of assigned or group task (leader/assigner only)
app.post('/api/todos/:id/reject-completion', auth, async (req, res) => {
  try {
    const { data: todo } = await supabaseAdmin
      .from('todos')
      .select('*, group:groups(leader_id)')
      .eq('id', req.params.id)
      .single();

    if (!todo || (todo.todo_type !== 'assigned' && todo.todo_type !== 'group')) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    if (!todo.pending_completion) {
      return res.status(400).json({ error: 'This task is not pending completion' });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    const isCoordinator = profile?.role === 'coordinator';
    const isAssigner = todo.assigned_by === req.user.id;
    const isGroupLeader = todo.group?.leader_id === req.user.id;

    // For assigned todos: assigner or coordinator can reject
    // For group todos: group leader or coordinator can reject
    const canReject = isCoordinator ||
      (todo.todo_type === 'assigned' && isAssigner) ||
      (todo.todo_type === 'group' && isGroupLeader);

    if (!canReject) {
      return res.status(403).json({ error: 'Only the leader or coordinator can reject completion' });
    }

    const { error } = await supabaseAdmin
      .from('todos')
      .update({ pending_completion: false })
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete todo
app.delete('/api/todos/:id', auth, async (req, res) => {
  try {
    const { data: todo } = await supabaseAdmin
      .from('todos')
      .select('*, group:groups(leader_id)')
      .eq('id', req.params.id)
      .single();

    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    const isCoordinator = profile?.role === 'coordinator';
    const isOwner = todo.user_id === req.user.id;
    const isGroupLeader = todo.group?.leader_id === req.user.id;
    const isAssigner = todo.assigned_by === req.user.id;

    let canDelete = false;

    if (todo.todo_type === 'personal') {
      canDelete = isOwner;
    } else if (todo.todo_type === 'global') {
      canDelete = isCoordinator;
    } else if (todo.todo_type === 'group') {
      canDelete = isGroupLeader || isCoordinator;
    } else if (todo.todo_type === 'assigned') {
      canDelete = isAssigner || isCoordinator;
    }

    if (!canDelete) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { error } = await supabaseAdmin
      .from('todos')
      .delete()
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Overtime request endpoints
app.post('/api/overtime', auth, async (req, res) => {
  try {
    const {
      employee_name,
      job_position,
      date_completed,
      department,
      periods = [],
      anticipated_hours,
      explanation,
      employee_signature,
      supervisor_signature,
      management_signature,
      approval_date
    } = req.body;

    if (!employee_name || !job_position) {
      return res.status(400).json({ error: 'Employee name and job position are required.' });
    }

    const safePeriods = Array.isArray(periods)
      ? periods
        .filter(p => p)
        .map(p => ({
          start_date: p.start_date || null,
          end_date: p.end_date || null,
          start_time: p.start_time || null,
          end_time: p.end_time || null
        }))
      : [];

    const { data, error } = await supabaseAdmin
      .from('overtime_requests')
      .insert({
        user_id: req.user.id,
        employee_name,
        job_position,
        date_completed: date_completed || new Date().toISOString().split('T')[0],
        department: department || null,
        periods: safePeriods,
        anticipated_hours: anticipated_hours || null,
        explanation: explanation || null,
        employee_signature: employee_signature || null,
        supervisor_signature: supervisor_signature || null,
        management_signature: management_signature || null,
        approval_date: approval_date || null
      })
      .select('id')
      .single();

    if (error) {
      console.error('Overtime insert error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Get all coordinators
    const { data: coordinators } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'coordinator');

    // Create notification for all coordinators
    if (coordinators && coordinators.length > 0) {
      const notifications = coordinators.map(coord => ({
        user_id: coord.id,
        type: 'ot_submitted',
        title: 'New Overtime Request',
        message: `${employee_name} submitted an overtime request.`,
        link: 'overtime-requests'
      }));

      console.log('Creating notifications for coordinators:', notifications);
      const { data: notifData, error: notifError } = await supabaseAdmin
        .from('notifications')
        .insert(notifications);

      if (notifError) {
        console.error('Notification insert error:', notifError);
      } else {
        console.log('Notifications created successfully:', notifData);
      }
    }

    res.status(201).json({ success: true, id: data.id });
  } catch (err) {
    console.error('Overtime insert exception:', err);
    res.status(500).json({ error: 'Failed to submit overtime request.' });
  }
});

app.get('/api/overtime/my', auth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('overtime_requests')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Overtime fetch error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    console.error('Overtime fetch exception:', err);
    res.status(500).json({ error: 'Failed to load overtime requests.' });
  }
});

app.get('/api/overtime/all', auth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'coordinator')
      return res.status(403).json({ error: 'Access denied' });

    const { data, error } = await supabaseAdmin
      .from('overtime_requests')
      .select('*, profiles!overtime_requests_user_id_fkey(full_name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Overtime coordinator fetch error:', error);
      return res.status(500).json({ error: error.message });
    }

    const formatted = data.map(item => ({
      ...item,
      full_name: item.profiles?.full_name
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Overtime coordinator fetch exception:', err);
    res.status(500).json({ error: 'Failed to load overtime requests.' });
  }
});

app.put('/api/overtime/:id/approve', auth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'coordinator') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const {
      supervisor_signature,
      management_signature,
      approval_date
    } = req.body;

    // Get overtime request details
    const { data: otRequest } = await supabaseAdmin
      .from('overtime_requests')
      .select('user_id, employee_name')
      .eq('id', req.params.id)
      .single();

    const { error } = await supabaseAdmin
      .from('overtime_requests')
      .update({
        supervisor_signature: supervisor_signature || null,
        management_signature: management_signature || null,
        approval_date: approval_date || new Date().toISOString().split('T')[0]
      })
      .eq('id', req.params.id);

    if (error) {
      console.error('Overtime approval update error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Create notification for intern
    if (otRequest?.user_id) {
      console.log('Creating notification for user:', otRequest.user_id);
      const { data: notifData, error: notifError } = await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: otRequest.user_id,
          type: 'ot_approved',
          title: 'Overtime Approved',
          message: 'Your overtime request has been approved by the coordinator.',
          link: 'overtime-status'
        });

      if (notifError) {
        console.error('Notification insert error:', notifError);
      } else {
        console.log('Notification created successfully:', notifData);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Overtime approval exception:', err);
    res.status(500).json({ error: 'Failed to update overtime approval.' });
  }
});

// Notification endpoints
app.get('/api/notifications', auth, async (req, res) => {
  try {
    console.log('Fetching notifications for user:', req.user.id);
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Notifications fetch error:', error);
      return res.status(500).json({ error: error.message });
    }
    console.log('Notifications fetched:', data?.length || 0);
    res.json(data);
  } catch (err) {
    console.error('Notifications fetch exception:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/notifications/:id/read', auth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    console.error('Mark notification read exception:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin manual check-in for users
app.post('/api/admin/checkin/:userId', auth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'coordinator') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { time_in, date } = req.body;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const { data, error } = await supabaseAdmin
      .from('attendance')
      .insert({
        user_id: req.params.userId,
        date: targetDate,
        time_in,
        status: 'On-Time',
        late_deduction_hours: 0
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin manual check-out for users
app.put('/api/admin/checkout/:attendanceId', auth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'coordinator') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { time_out } = req.body;

    const { error } = await supabaseAdmin
      .from('attendance')
      .update({ time_out })
      .eq('id', req.params.attendanceId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
