# Notification System Documentation

## Overview
The Triple G BuildHub Attendance System uses a real-time notification system to keep users informed about important events and actions.

## Notification Triggers

### 1. Overtime Request Submitted (`ot_submitted`)
**Trigger:** When an intern submits a new overtime request  
**Recipients:** All coordinators  
**Type:** `overtime`  
**Title:** "New Overtime Request"  
**Message:** "{employee_name} submitted an overtime request."  
**Link:** `overtime-requests`  
**Code Location:** `backend/server.js` - POST `/api/overtime`

### 2. Overtime Request Approved (`ot_approved`)
**Trigger:** When a coordinator approves an overtime request  
**Recipients:** The intern who submitted the request  
**Type:** `overtime`  
**Title:** "Overtime Approved"  
**Message:** "Your overtime request has been approved by the coordinator."  
**Link:** `overtime-status`  
**Code Location:** `backend/server.js` - PUT `/api/overtime/:id/approve`

## Notification Categories

### All (`all`)
- Shows all notifications regardless of type
- Icon: 📋

### Overtime (`overtime`)
- Includes: `ot_submitted`, `ot_approved`, `ot_reminder`
- Icon: ⏰
- Related to overtime requests and approvals

### Attendance (`attendance`)
- Includes: `pending_checkout`, attendance-related notifications
- Icon: ✓
- Related to check-in/check-out activities

### System (`system`)
- Includes: General system notifications
- Icon: ⚙️
- Related to system updates and announcements

## Notification States

### Read/Unread Tabs
- **All:** Shows all notifications
- **Unread:** Shows only unread notifications (with count badge)
- **Read:** Shows only read notifications

### Visual Indicators
- **Unread:** Orange dot indicator, highlighted background
- **Read:** No indicator, transparent background

## Database Schema

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'ot_submitted', 'ot_approved', 'ot_reminder', 'pending_checkout'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT, -- page to navigate to
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## API Endpoints

### GET `/api/notifications`
Fetch all notifications for the authenticated user
- **Auth:** Required
- **Returns:** Array of notification objects

### PUT `/api/notifications/:id/read`
Mark a specific notification as read
- **Auth:** Required
- **Params:** `id` - Notification ID
- **Returns:** Success status

## Frontend Components

### NotificationPanel
Location: `frontend/src/components/NotificationPanel.js`

Features:
- Tab filtering (All/Unread/Read)
- Category filtering (All/Overtime/Attendance/System)
- Mark all as read functionality
- Click to navigate and mark as read
- Real-time updates every 30 seconds

### Integration
Location: `frontend/src/App.js`

- Bell icon with unread count badge
- Dropdown panel with NotificationPanel component
- Auto-refresh every 30 seconds
- Mobile-responsive design

## Future Notification Types

### Potential Additions:
1. **Pending Checkout Reminder** (`pending_checkout`)
   - Trigger: When user hasn't checked out after work hours
   - Type: `attendance`

2. **Overtime Reminder** (`ot_reminder`)
   - Trigger: Scheduled reminder for upcoming overtime
   - Type: `overtime`

3. **Late Check-in Alert** (`late_checkin`)
   - Trigger: When user checks in late
   - Type: `attendance`

4. **System Announcement** (`system_announcement`)
   - Trigger: Admin broadcasts important updates
   - Type: `system`

## Adding New Notification Types

1. **Backend:** Add notification insert in relevant endpoint
```javascript
await supabaseAdmin
  .from('notifications')
  .insert({
    user_id: targetUserId,
    type: 'notification_type',
    title: 'Notification Title',
    message: 'Notification message',
    link: 'page-to-navigate'
  });
```

2. **Frontend:** Update category mapping in `NotificationPanel.js`
```javascript
const getCategoryFromType = (type) => {
  if (type.includes('ot_')) return 'overtime';
  if (type.includes('checkout') || type.includes('attendance')) return 'attendance';
  if (type.includes('new_type')) return 'new_category';
  return 'system';
};
```

3. **Add new category if needed:**
```javascript
const categories = {
  // ... existing categories
  new_category: { label: 'New Category', icon: '🔔' }
};
```

## Best Practices

1. **Always create notifications in try-catch blocks**
2. **Log notification creation for debugging**
3. **Don't fail the main operation if notification fails**
4. **Use descriptive titles and messages**
5. **Include navigation links when relevant**
6. **Test notification delivery for all user roles**
