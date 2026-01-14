require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

app.use(cors());
app.use(express.json());

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
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
  
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return res.status(400).json({ error: error.message });
  
  if (data.user) {
    const { error: profileError } = await supabase
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
    const date = new Date().toISOString().split('T')[0];
    
    // Convert AM/PM time to 24-hour for comparison
    const timeIn24 = convertTo24Hour(time_in);
    const timeInDate = new Date(`${date}T${timeIn24}`);
    const cutoffTime = new Date(`${date}T08:05:00`);
    const onTimeLimit = new Date(`${date}T08:00:00`);
    
    let status = 'On-Time';
    let lateDeduction = 0;
    let lateMinutes = 0;
    
    if (timeInDate > cutoffTime) {
      status = 'Late';
      lateMinutes = Math.floor((timeInDate - onTimeLimit) / 60000);
      lateDeduction = 1;
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

app.put('/api/attendance/checkout/:id', auth, async (req, res) => {
  try {
    const { time_out, work_documentation } = req.body;
    console.log('Checkout request:', { id: req.params.id, time_out, work_documentation, user_id: req.user.id });
    
    const { error } = await supabaseAdmin
      .from('attendance')
      .update({ time_out, work_documentation })
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
  const now = new Date();
  const otTimeIn = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
  const { error } = await supabaseAdmin
    .from('attendance')
    .update({ ot_time_in: otTimeIn })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.put('/api/attendance/overtime-out/:id', auth, async (req, res) => {
  const now = new Date();
  const otTimeOut = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
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
    .select('id, full_name, profile_picture')
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
    res.status(500).json({ error: err.message });
  }
});

// Todo endpoints
app.get('/api/todos', auth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('todos')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/todos', auth, async (req, res) => {
  const { task } = req.body;
  const { data, error } = await supabaseAdmin
    .from('todos')
    .insert({ user_id: req.user.id, task })
    .select()
    .single();
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/todos/:id', auth, async (req, res) => {
  const { completed } = req.body;
  const { error } = await supabaseAdmin
    .from('todos')
    .update({ completed })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.delete('/api/todos/:id', auth, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('todos')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
