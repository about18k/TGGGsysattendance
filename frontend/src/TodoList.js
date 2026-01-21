import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { CardSkeleton } from './components/SkeletonLoader';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function TodoList({ token, user }) {
  const [todos, setTodos] = useState([]);
  const [groups, setGroups] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [interns, setInterns] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateTask, setDateTask] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('personal');
  const [userProfile, setUserProfile] = useState(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showManageGroupModal, setShowManageGroupModal] = useState(false);
  const [showLeaderModal, setShowLeaderModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [deadlineDate, setDeadlineDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const itemsPerPage = 5;

  const fetchUserProfile = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserProfile(data);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
  }, [token]);

  const fetchGroups = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/groups`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroups(data);
      if (data.length > 0 && !selectedGroup) {
        setSelectedGroup(data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    }
  }, [token, selectedGroup]);

  const fetchTodos = useCallback(async (tab = activeTab) => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/todos?type=${tab}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTodos(data);
    } catch (err) {
      console.error('Failed to fetch todos:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, token]);

  const fetchAvailableUsers = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/users/available`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableUsers(data);
    } catch (err) {
      console.error('Failed to fetch available users:', err);
    }
  }, [token]);

  const fetchInterns = useCallback(async () => {
    if (user?.role !== 'coordinator') return;
    try {
      const { data } = await axios.get(`${API}/users/interns`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInterns(data);
    } catch (err) {
      console.error('Failed to fetch interns:', err);
    }
  }, [token, user?.role]);

  useEffect(() => {
    fetchUserProfile();
    fetchTodos(activeTab);
    fetchGroups();
    if (user?.role === 'coordinator' || userProfile?.is_leader) {
      fetchAvailableUsers();
    }
    if (user?.role === 'coordinator') {
      fetchInterns();
    }
    // eslint-disable-next-line
  }, [activeTab]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, activeTab]);

  const isCoordinator = user?.role === 'coordinator';
  const isLeader = userProfile?.is_leader;
  const leaderHasGroup = groups.some(g => g.leader_id === userProfile?.id);

  const addDateTodo = async (e) => {
    e.preventDefault();
    if (!dateTask.trim()) return;
    
    try {
      const deadlineSuffix = activeTab === 'assigned' && deadlineDate
        ? ` (Deadline: ${new Date(deadlineDate).toLocaleDateString()})`
        : '';
      const taskWithDate = `[${selectedDate.toLocaleDateString()}] ${dateTask}${deadlineSuffix}`;
      const todoData = { 
        task: taskWithDate, 
        todo_type: activeTab 
      };

      if (activeTab === 'group' && selectedGroup) {
        todoData.group_id = selectedGroup;
      } else if (activeTab === 'assigned' && selectedAssignee) {
        todoData.assigned_to = selectedAssignee;
      }

      await axios.post(`${API}/todos`, todoData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDateTask('');
      setSelectedAssignee('');
      await fetchTodos(activeTab);
    } catch (error) {
      console.error('Error adding task:', error);
      alert(error.response?.data?.error || 'Failed to add task.');
    }
  };

  const toggleTodo = async (id, completed) => {
    try {
      await axios.put(`${API}/todos/${id}`, { completed: !completed }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTodos(activeTab);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update task.');
    }
  };

  const deleteTodo = async (id) => {
    try {
      await axios.delete(`${API}/todos/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTodos(activeTab);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete task.');
    }
  };

  const confirmTodo = async (id) => {
    try {
      await axios.post(`${API}/todos/${id}/confirm`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTodos(activeTab);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to confirm task.');
    }
  };

  const confirmCompletion = async (id) => {
    try {
      await axios.post(`${API}/todos/${id}/confirm-completion`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTodos(activeTab);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to confirm completion.');
    }
  };

  const rejectCompletion = async (id) => {
    try {
      await axios.post(`${API}/todos/${id}/reject-completion`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTodos(activeTab);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to reject completion.');
    }
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    if (isLeader && leaderHasGroup) {
      alert('You already lead a group. Leaders can only own one group.');
      return;
    }
    try {
      await axios.post(`${API}/groups`, {
        name: newGroupName,
        description: newGroupDesc
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewGroupName('');
      setNewGroupDesc('');
      setShowGroupModal(false);
      fetchGroups();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to create group.');
    }
  };

  const addMemberToGroup = async (groupId, userId) => {
    try {
      await axios.post(`${API}/groups/${groupId}/members`, { user_id: userId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchGroups();
      fetchAvailableUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to add member.');
    }
  };

  const removeMemberFromGroup = async (groupId, userId) => {
    try {
      await axios.delete(`${API}/groups/${groupId}/members/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchGroups();
      fetchAvailableUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to remove member.');
    }
  };

  const deleteGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to delete this group? All group todos will be deleted.')) {
      return;
    }
    try {
      await axios.delete(`${API}/groups/${groupId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchGroups();
      setSelectedGroup(null);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete group.');
    }
  };

  const toggleLeader = async (userId, isCurrentlyLeader) => {
    try {
      const endpoint = isCurrentlyLeader ? 'remove-leader' : 'make-leader';
      await axios.post(`${API}/users/${userId}/${endpoint}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchInterns();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update leader status.');
    }
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const changeMonth = (offset) => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + offset, 1));
  };

  const getFilteredTodos = () => {
    const dateStr = selectedDate.toLocaleDateString();
    let filtered = todos.filter(todo => todo.task.includes(`[${dateStr}]`));
    
    // For group tab, filter by selected group OR include assigned tasks (which don't have group_id)
    if (activeTab === 'group' && selectedGroup) {
      filtered = filtered.filter(todo => 
        todo.group_id === selectedGroup || todo.todo_type === 'assigned'
      );
    }
    
    return filtered;
  };

  const canAddTodo = () => {
    if (activeTab === 'personal') return true;
    // Leaders use Assigned tab instead of Group tab for adding tasks
    if (activeTab === 'group') return groups.length > 0 && !isLeader && !isCoordinator;
    if (activeTab === 'assigned') return isCoordinator || isLeader;
    return false;
  };

  const canEditTodo = (todo) => {
    if (todo.todo_type === 'personal') return todo.user_id === userProfile?.id;
    if (todo.todo_type === 'group') {
      const group = groups.find(g => g.id === todo.group_id);
      return group?.leader_id === userProfile?.id;
    }
    if (todo.todo_type === 'assigned') {
      return todo.assigned_by === userProfile?.id || isCoordinator;
    }
    return false;
  };

  const canDeleteTodo = (todo) => {
    return canEditTodo(todo);
  };

  const canToggleTodo = (todo) => {
    if (todo.todo_type === 'assigned') {
      return todo.assigned_to === userProfile?.id || todo.assigned_by === userProfile?.id || isCoordinator;
    }
    return canEditTodo(todo);
  };

  const getGroupMembersForAssign = () => {
    if (isCoordinator) {
      return interns;
    }
    const myGroups = groups.filter(g => g.leader_id === userProfile?.id);
    const members = [];
    // Add the leader themselves first (for self-assign)
    if (userProfile && isLeader) {
      members.push({ id: userProfile.id, full_name: `${userProfile.full_name} (Myself)` });
    }
    myGroups.forEach(g => {
      g.members?.forEach(m => {
        if (m.user && !members.find(mem => mem.id === m.user.id)) {
          members.push(m.user);
        }
      });
    });
    return members;
  };

  // Separate active and completed tasks for assigned tab
  const getActiveTodos = () => {
    return filteredTodos.filter(todo => !todo.completed);
  };

  const getCompletedTodos = () => {
    return filteredTodos.filter(todo => todo.completed);
  };

  const renderAssignedCard = (todo) => (
    <div
      key={todo.id}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        padding: '1rem',
        background: '#00273C',
        borderRadius: '8px',
        marginBottom: '0.75rem',
        border: `1px solid ${todo.pending_completion ? 'rgba(255, 165, 0, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
        <span style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: todo.pending_completion ? '#ffa500' : '#6aa9ff',
          display: 'inline-block',
          flexShrink: 0
        }} />
        <span style={{
          flex: 1,
          color: todo.pending_completion ? '#ffa500' : '#e8eaed',
          fontSize: '0.95rem',
          wordBreak: 'break-word'
        }}>
          {todo.task.replace(/\[.*?\]\s*/, '')}
        </span>
      </div>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', color: '#6b7280'}}>
        {todo.todo_type === 'group' && todo.group && (
          <span style={{background: 'rgba(255, 113, 32, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px'}}>
            Group: {todo.group.name}
          </span>
        )}
        {todo.todo_type === 'group' && todo.suggester && (
          <span style={{background: 'rgba(100, 100, 255, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px'}}>
            Suggested by: {todo.suggester.full_name}
          </span>
        )}
        {todo.todo_type === 'assigned' && todo.assignee && (
          <span style={{background: 'rgba(100, 255, 100, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px'}}>
            Assigned to: {todo.assignee.full_name}
          </span>
        )}
        {todo.todo_type === 'assigned' && todo.assigner && (
          <span style={{background: 'rgba(255, 100, 100, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px'}}>
            Assigned by: {todo.assigner.full_name}
          </span>
        )}
        {todo.date_assigned && (
          <span style={{background: 'rgba(150, 150, 150, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px'}}>
            Date: {new Date(todo.date_assigned).toLocaleDateString()}
          </span>
        )}
        {todo.pending_completion && (
          <span style={{background: 'rgba(255, 165, 0, 0.2)', padding: '0.25rem 0.5rem', borderRadius: '4px', color: '#ffa500'}}>
            Pending Approval
          </span>
        )}
      </div>
      <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
        {todo.todo_type === 'group' && !todo.pending_completion && 
          !(groups.find(g => g.id === todo.group_id)?.leader_id === userProfile?.id) && (
          <button
            onClick={() => toggleTodo(todo.id, todo.completed)}
            style={{
              flex: 1,
              background: '#28a745',
              border: 'none',
              color: 'white',
              padding: '0.65rem 1rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            ✓ Complete
          </button>
        )}
        {todo.todo_type === 'group' && todo.pending_completion && 
          !(groups.find(g => g.id === todo.group_id)?.leader_id === userProfile?.id) && (
          <button
            onClick={() => rejectCompletion(todo.id)}
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px solid rgba(255, 165, 0, 0.5)',
              color: '#ffa500',
              padding: '0.65rem 1rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            ✗ Cancel
          </button>
        )}
        {todo.todo_type === 'assigned' && todo.assigned_to === todo.assigned_by && todo.assigned_to === userProfile?.id && (
          <button
            onClick={() => toggleTodo(todo.id, todo.completed)}
            style={{
              flex: 1,
              background: '#28a745',
              border: 'none',
              color: 'white',
              padding: '0.65rem 1rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            ✓ Complete
          </button>
        )}
        {todo.todo_type === 'assigned' && todo.assigned_to !== todo.assigned_by && todo.assigned_to === userProfile?.id && !todo.pending_completion && (
          <button
            onClick={() => toggleTodo(todo.id, todo.completed)}
            style={{
              flex: 1,
              background: '#FF7120',
              border: 'none',
              color: 'white',
              padding: '0.65rem 1rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            ✓ Mark Complete
          </button>
        )}
        {todo.todo_type === 'assigned' && todo.assigned_to !== todo.assigned_by && todo.assigned_to === userProfile?.id && todo.pending_completion && (
          <button
            onClick={() => rejectCompletion(todo.id)}
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px solid rgba(255, 165, 0, 0.5)',
              color: '#ffa500',
              padding: '0.65rem 1rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            ✗ Cancel
          </button>
        )}
        {todo.pending_completion && (
          todo.assigned_by === userProfile?.id || 
          isCoordinator || 
          (todo.todo_type === 'group' && groups.find(g => g.id === todo.group_id)?.leader_id === userProfile?.id)
        ) && (
          <>
            <button
              onClick={() => confirmCompletion(todo.id)}
              style={{
                flex: 1,
                background: '#28a745',
                border: 'none',
                color: 'white',
                padding: '0.65rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              ✓ Complete
            </button>
            <button
              onClick={() => rejectCompletion(todo.id)}
              style={{
                flex: 1,
                background: 'transparent',
                border: '1px solid rgba(255, 80, 80, 0.5)',
                color: '#ff5050',
                padding: '0.65rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              ✗ Reject
            </button>
          </>
        )}
        {canDeleteTodo(todo) && !todo.pending_completion && (
          <button
            onClick={() => deleteTodo(todo.id)}
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px solid rgba(255, 113, 32, 0.3)',
              color: '#FF7120',
              padding: '0.65rem 1rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );

  const renderCompletedAssignedCard = (todo) => (
    <div
      key={todo.id}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        padding: '1rem',
        background: 'rgba(0, 39, 60, 0.5)',
        borderRadius: '8px',
        marginBottom: '0.5rem',
        border: '1px solid rgba(40, 167, 69, 0.3)',
        opacity: 0.8
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
        <span style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: '#28a745',
          display: 'inline-block',
          flexShrink: 0
        }} />
        <span style={{
          flex: 1,
          color: '#6b7280',
          textDecoration: 'line-through',
          fontSize: '0.95rem',
          wordBreak: 'break-word'
        }}>
          {todo.task.replace(/\[.*?\]\s*/, '')}
        </span>
      </div>
      <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', color: '#6b7280'}}>
        <span style={{background: 'rgba(150, 150, 150, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px'}}>
          Date: {new Date(todo.date_assigned || todo.created_at).toLocaleDateString()}
        </span>
        {todo.todo_type === 'group' && todo.group && (
          <span style={{background: 'rgba(255, 113, 32, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px'}}>
            Group: {todo.group.name}
          </span>
        )}
        {todo.todo_type === 'group' && todo.suggester && (
          <span style={{background: 'rgba(100, 100, 255, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px'}}>
            Suggested: {todo.suggester.full_name}
          </span>
        )}
        {todo.todo_type === 'group' && todo.suggester && (
          <span style={{background: 'rgba(100, 255, 100, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px'}}>
            Completed by: {todo.suggester.full_name}
          </span>
        )}
        {todo.todo_type === 'assigned' && todo.assignee && (
          <span style={{background: 'rgba(100, 255, 100, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px'}}>
            Completed by: {todo.assignee.full_name}
          </span>
        )}
        <span style={{background: 'rgba(40, 167, 69, 0.2)', padding: '0.25rem 0.5rem', borderRadius: '4px', color: '#28a745', fontWeight: '500'}}>
          Completed
        </span>
      </div>
    </div>
  );

  const renderStandardCard = (todo, isCompletedSection) => (
    <div
      key={todo.id}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        padding: '1rem',
        background: '#00273C',
        borderRadius: '8px',
        marginBottom: '0.75rem',
        border: `1px solid ${
          todo.pending_completion ? 'rgba(255, 165, 0, 0.5)' :
          todo.is_confirmed === false ? 'rgba(255, 193, 7, 0.5)' : 
          'rgba(255, 255, 255, 0.1)'
        }`,
        opacity: todo.is_confirmed === false ? 0.8 : 1
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
        {activeTab === 'group' && todo.todo_type === 'assigned' && todo.assigned_to !== userProfile?.id ? (
          <span style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            background: '#5ecda5',
            display: 'inline-block',
            flexShrink: 0
          }} />
        ) : (
          <input
            type="checkbox"
            checked={todo.completed || todo.pending_completion}
            onChange={() => canToggleTodo(todo) && !todo.pending_completion && toggleTodo(todo.id, todo.completed)}
            disabled={!canToggleTodo(todo) || todo.pending_completion}
            style={{
              width: '20px',
              height: '20px',
              cursor: (canToggleTodo(todo) && !todo.pending_completion) ? 'pointer' : 'not-allowed',
              accentColor: todo.pending_completion ? '#ffa500' : '#FF7120',
              flexShrink: 0,
              opacity: (canToggleTodo(todo) && !todo.pending_completion) ? 1 : 0.5
            }}
          />
        )}
        <span
          style={{
            flex: 1,
            color: isCompletedSection ? '#6b7280' : todo.pending_completion ? '#ffa500' : '#e8eaed',
            textDecoration: isCompletedSection ? 'line-through' : 'none',
            fontSize: '0.95rem',
            wordBreak: 'break-word'
          }}
        >
          {todo.task.replace(/\[.*?\]\s*/, '')}
        </span>
      </div>

      <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', color: '#6b7280'}}>
        {activeTab === 'group' && todo.todo_type === 'assigned' && (
          <span style={{background: 'rgba(100, 149, 237, 0.2)', padding: '0.25rem 0.5rem', borderRadius: '4px', color: '#6495ED', fontWeight: '500'}}>
            Assigned Task
          </span>
        )}
        {todo.todo_type === 'group' && todo.group && (
          <span style={{background: 'rgba(255, 113, 32, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px'}}>
            Group: {todo.group.name}
          </span>
        )}
        {todo.todo_type === 'group' && todo.suggester && (
          <span style={{background: 'rgba(100, 100, 255, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px'}}>
            Suggested by: {todo.suggester.full_name}
          </span>
        )}
        {todo.todo_type === 'assigned' && todo.assignee && (
          <span style={{background: 'rgba(100, 255, 100, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px'}}>
            Assigned to: {todo.assignee.full_name}
          </span>
        )}
        {todo.todo_type === 'assigned' && todo.assigner && (
          <span style={{background: 'rgba(255, 100, 100, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px'}}>
            Assigned by: {todo.assigner.full_name}
          </span>
        )}
        {todo.todo_type === 'assigned' && todo.date_assigned && (
          <span style={{background: 'rgba(150, 150, 150, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px'}}>
            Assigned: {new Date(todo.date_assigned).toLocaleDateString()}
          </span>
        )}
        {todo.is_confirmed === false && (
          <span style={{background: 'rgba(255, 193, 7, 0.2)', padding: '0.25rem 0.5rem', borderRadius: '4px', color: '#ffc107'}}>
            Pending Confirmation
          </span>
        )}
        {todo.pending_completion && (
          <span style={{background: 'rgba(255, 165, 0, 0.2)', padding: '0.25rem 0.5rem', borderRadius: '4px', color: '#ffa500'}}>
            Pending Completion Approval
          </span>
        )}
        {todo.todo_type === 'assigned' && todo.completed && (
          <span style={{background: 'rgba(40, 167, 69, 0.2)', padding: '0.25rem 0.5rem', borderRadius: '4px', color: '#28a745'}}>
            ✓ Completed
          </span>
        )}
      </div>

      {!(activeTab === 'group' && todo.todo_type === 'assigned' && todo.assigned_to !== userProfile?.id) && !isCompletedSection && (
        <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
          {todo.todo_type === 'group' && todo.is_confirmed === false && 
            groups.find(g => g.id === todo.group_id)?.leader_id === userProfile?.id && (
            <button
              onClick={() => confirmTodo(todo.id)}
              style={{
                flex: 1,
                background: '#28a745',
                border: 'none',
                color: 'white',
                padding: '0.65rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              ✓ Confirm Task
            </button>
          )}
          {activeTab === 'group' && todo.todo_type === 'assigned' && 
            todo.assigned_to === userProfile?.id && !todo.pending_completion && !todo.completed && (
            <button
              onClick={() => toggleTodo(todo.id, todo.completed)}
              style={{
                flex: 1,
                background: '#FF7120',
                border: 'none',
                color: 'white',
                padding: '0.65rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              ✓ Mark Complete
            </button>
          )}
          {activeTab === 'group' && todo.todo_type === 'assigned' && 
            todo.assigned_to === userProfile?.id && todo.pending_completion && (
            <button
              onClick={() => rejectCompletion(todo.id)}
              style={{
                flex: 1,
                background: 'transparent',
                border: '1px solid rgba(255, 165, 0, 0.5)',
                color: '#ffa500',
                padding: '0.65rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              ✗ Cancel
            </button>
          )}
          {todo.todo_type === 'assigned' && todo.pending_completion && 
            (todo.assigned_by === userProfile?.id || isCoordinator) && (
            <button
              onClick={() => confirmCompletion(todo.id)}
              style={{
                flex: 1,
                background: '#28a745',
                border: 'none',
                color: 'white',
                padding: '0.65rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              ✓ Confirm Completion
            </button>
          )}
          {canDeleteTodo(todo) && activeTab !== 'group' && (
            <button
              onClick={() => deleteTodo(todo.id)}
              style={{
                flex: 1,
                background: 'transparent',
                border: '1px solid rgba(255, 113, 32, 0.3)',
                color: '#FF7120',
                padding: '0.65rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );

  const filteredTodos = getFilteredTodos();
  const ongoingTodos = filteredTodos.filter(todo => !todo.completed);
  const doneTodos = filteredTodos.filter(todo => todo.completed);
  const { firstDay, daysInMonth } = getDaysInMonth(selectedDate);
  const monthName = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const tabs = [
    { id: 'personal', label: 'Personal' },
    { id: 'group', label: 'Team' },
    { id: 'assigned', label: 'Group' }
  ];

  const currentGroup = groups.find(g => g.id === selectedGroup);

  return (
    <div className="dashboard" style={{overflowX: 'hidden'}}>
      {/* Tab Navigation + Calendar Toggle */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        padding: '0.5rem',
        background: '#00273C',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{display: 'flex', flex: '1 1 auto', gap: '0.5rem', flexWrap: 'wrap'}}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: '1 1 auto',
                minWidth: '100px',
                padding: '0.75rem 1rem',
                background: activeTab === tab.id ? '#FF7120' : 'transparent',
                color: activeTab === tab.id ? 'white' : '#e8eaed',
                border: '1px solid rgba(255, 113, 32, 0.3)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <span style={{width: '10px', height: '10px', borderRadius: '50%', background: tab.id === 'personal' ? '#6aa9ff' : tab.id === 'group' ? '#f5a524' : '#5ecda5', display: 'inline-block'}} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Management Buttons for Coordinators/Leaders - shown only on Group tab (assigned view) */}
      {(isCoordinator || isLeader) && activeTab === 'assigned' && (
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap'
        }}>
          {(isCoordinator || (isLeader && !leaderHasGroup)) && (
            <button
              onClick={() => { setShowGroupModal(true); fetchAvailableUsers(); }}
              style={{
                padding: '0.75rem 1rem',
                background: 'transparent',
                color: '#FF7120',
                border: '1px solid rgba(255, 113, 32, 0.3)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              ➕ Create Group
            </button>
          )}
          {groups.length > 0 && (
            <button
              onClick={() => { setShowManageGroupModal(true); fetchAvailableUsers(); }}
              style={{
                padding: '0.75rem 1rem',
                background: 'transparent',
                color: '#FF7120',
                border: '1px solid rgba(255, 113, 32, 0.3)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              ⚙️ Manage Groups
            </button>
          )}
          {isCoordinator && (
            <button
              onClick={() => { setShowLeaderModal(true); fetchInterns(); }}
              style={{
                padding: '0.75rem 1rem',
                background: 'transparent',
                color: '#FF7120',
                border: '1px solid rgba(255, 113, 32, 0.3)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              👑 Manage Leaders
            </button>
          )}
        </div>
      )}

      <div className="todo-layout" style={{display: 'flex', gap: '1.5rem', alignItems: 'stretch', flexWrap: 'wrap', maxWidth: '100%'}}>
        <div className="welcome todo-sidebar" style={{flex: '1 1 300px', maxWidth: '350px', order: 1, boxSizing: 'border-box', display: 'flex', flexDirection: 'column'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem'}}>
            <h2 style={{margin: 0}}>{tabs.find(t => t.id === activeTab)?.icon} {tabs.find(t => t.id === activeTab)?.label} Todo List</h2>
            <button
              onClick={() => setShowCalendar(s => !s)}
              title="Toggle calendar"
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 113, 32, 0.3)',
                color: '#FF7120',
                borderRadius: '8px',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                letterSpacing: '0.02em'
              }}
            >
              CAL
            </button>
          </div>
          <p style={{marginBottom: '1rem'}}>
            {activeTab === 'personal' && 'Your private tasks - only you can see these'}
            {activeTab === 'group' && 'Team tasks - suggest items and await leader confirmation'}
            {activeTab === 'assigned' && 'Group tasks you assign to members or that your leader assigned to you'}
          </p>

          {showCalendar && (
            <div className="checkin-form todo-calendar" style={{marginBottom: '1rem', padding: '1rem'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                <h3 style={{margin: 0}}>Calendar</h3>
                <div style={{display: 'flex', gap: '0.35rem'}}>
                  <button onClick={() => changeMonth(-1)} style={{background: 'transparent', border: '1px solid rgba(255, 113, 32, 0.3)', color: '#FF7120', padding: '0.35rem 0.7rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem'}}>‹</button>
                  <button onClick={() => changeMonth(1)} style={{background: 'transparent', border: '1px solid rgba(255, 113, 32, 0.3)', color: '#FF7120', padding: '0.35rem 0.7rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem'}}>›</button>
                </div>
              </div>
              <div style={{display: 'flex', justifyContent: 'center', marginBottom: '0.75rem'}}>
                <span style={{color: '#e8eaed', fontSize: '0.95rem', fontWeight: '500'}}>{monthName}</span>
              </div>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.3rem', marginBottom: '0.5rem'}}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                  <div key={day} style={{textAlign: 'center', color: '#6b7280', fontSize: '0.75rem', padding: '0.3rem', fontWeight: '600'}}>{day}</div>
                ))}
              </div>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.3rem'}}>
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
                  const isSelected = date.toDateString() === selectedDate.toDateString();
                  const isToday = date.toDateString() === new Date().toDateString();
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDate(date)}
                      style={{
                        padding: '0.5rem',
                        background: isSelected ? '#FF7120' : isToday ? 'rgba(255, 113, 32, 0.2)' : 'transparent',
                        color: isSelected ? 'white' : '#e8eaed',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: isSelected || isToday ? '600' : '400',
                        transition: 'all 0.2s',
                        minWidth: 0
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          
          {activeTab === 'group' && groups.length > 0 && (
            <div style={{marginBottom: '1rem'}}>
              <label style={{display: 'block', marginBottom: '0.5rem', color: '#e8eaed', fontSize: '0.85rem'}}>
                Select Group:
              </label>
              <select
                value={selectedGroup || ''}
                onChange={(e) => setSelectedGroup(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#00273C',
                  color: '#e8eaed',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  fontSize: '0.9rem'
                }}
              >
                {groups.map(group => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
              {currentGroup && (
                <div style={{marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(255, 113, 32, 0.1)', borderRadius: '8px'}}>
                  <p style={{fontSize: '0.8rem', color: '#e8eaed', margin: '0 0 0.25rem 0'}}>
                    <strong>Leader:</strong> {currentGroup.leader?.full_name || 'None'}
                  </p>
                  <p style={{fontSize: '0.8rem', color: '#e8eaed', margin: 0}}>
                    <strong>Members:</strong> {currentGroup.members?.length || 0}
                  </p>
                </div>
              )}
            </div>
          )}

          <div style={{marginTop: 'auto', padding: '1rem', background: 'rgba(255, 113, 32, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 113, 32, 0.2)'}}>
            <p style={{fontSize: '0.85rem', color: '#e8eaed', marginBottom: '0.5rem'}}>
              {activeTab === 'personal' && 'These tasks are private to you.'}
              {activeTab === 'group' && 'Team members can suggest tasks; leaders confirm before work starts.'}
              {activeTab === 'assigned' && 'Assign tasks to members and track completions here.'}
            </p>
          </div>

          <div className="checkin-form" style={{marginTop: '1rem', padding: '1rem'}}>
            <h3 style={{fontSize: '1rem', marginBottom: '0.75rem'}}>Add Task</h3>
            {canAddTodo() ? (
              <form onSubmit={addDateTodo} style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                <input
                  type="text"
                  value={dateTask}
                  onChange={(e) => setDateTask(e.target.value)}
                  placeholder={activeTab === 'assigned' ? 'Enter task to assign...' : 'Enter your task...'}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#001824',
                    color: '#e8eaed',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    fontSize: '0.9rem'
                  }}
                  required
                />

                {activeTab === 'assigned' && (
                  <select
                    value={selectedAssignee}
                    onChange={(e) => setSelectedAssignee(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#001824',
                      color: '#e8eaed',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      fontSize: '0.9rem'
                    }}
                    required
                  >
                    <option value="">Select assignee...</option>
                    {getGroupMembersForAssign().map(member => (
                      <option key={member.id} value={member.id}>{member.full_name}</option>
                    ))}
                  </select>
                )}

                {activeTab === 'assigned' && (
                  <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                    <div style={{flex: '1 1 180px', minWidth: 0}}>
                      <label style={{display: 'block', marginBottom: '0.35rem', color: '#e8eaed', fontSize: '0.8rem'}}>Work Date</label>
                      <input
                        type="date"
                        value={selectedDate ? new Date(selectedDate).toISOString().split('T')[0] : ''}
                        onChange={(e) => setSelectedDate(new Date(e.target.value))}
                        style={{
                          width: '100%',
                          padding: '0.6rem',
                          background: '#001824',
                          color: '#e8eaed',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '6px',
                          fontSize: '0.9rem'
                        }}
                        required
                      />
                    </div>
                    <div style={{flex: '1 1 180px', minWidth: 0}}>
                      <label style={{display: 'block', marginBottom: '0.35rem', color: '#e8eaed', fontSize: '0.8rem'}}>Deadline</label>
                      <input
                        type="date"
                        value={deadlineDate ? new Date(deadlineDate).toISOString().split('T')[0] : ''}
                        onChange={(e) => setDeadlineDate(new Date(e.target.value))}
                        style={{
                          width: '100%',
                          padding: '0.6rem',
                          background: '#001824',
                          color: '#e8eaed',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '6px',
                          fontSize: '0.9rem'
                        }}
                        required
                      />
                    </div>
                  </div>
                )}

                <button type="submit" className="todo-add-btn" style={{width: '100%', padding: '0.75rem'}}>
                  {activeTab === 'group' && !isLeader && !isCoordinator ? 'Suggest Task' : 'Add Task'}
                </button>
              </form>
            ) : (
              <div style={{padding: '0.75rem', background: 'rgba(255, 113, 32, 0.1)', borderRadius: '6px', border: '1px solid rgba(255, 113, 32, 0.2)'}}>
                <p style={{margin: 0, color: '#e8eaed', fontSize: '0.9rem'}}>
                  {activeTab === 'group' && (isLeader || isCoordinator) && 'Leaders assign tasks via the Group tab.'}
                  {activeTab === 'group' && !isLeader && !isCoordinator && 'You need to be in a group to add group tasks.'}
                  {activeTab === 'assigned' && 'Only leaders and coordinators can assign tasks.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Calendar card removed from center; calendar lives in the sidebar via icon toggle */}

        <div className="checkin-form todo-main" style={{flex: '1 1 500px', order: 3, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', maxHeight: '650px', overflow: 'hidden'}}>
        {loading ? (
          <CardSkeleton />
        ) : (
          <>
            <h3 style={{flexShrink: 0}}>Tasks for {selectedDate.toLocaleDateString()}</h3>
            
            <div style={{flex: 1, overflowY: 'auto', paddingRight: '0.5rem'}}>
              {activeTab === 'assigned' ? (
                /* Assigned Tab - Ongoing and Completed */
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem'}}>
                  <div>
                    <h3 style={{color: '#e8eaed', fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                      <span style={{width: '10px', height: '10px', borderRadius: '50%', background: '#5ecda5', display: 'inline-block'}} />
                      Ongoing Tasks
                      <span style={{background: 'rgba(255, 113, 32, 0.2)', padding: '0.2rem 0.5rem', borderRadius: '10px', fontSize: '0.8rem'}}>
                        {getActiveTodos().length}
                      </span>
                    </h3>
                    {getActiveTodos().length === 0 ? (
                      <p style={{textAlign: 'center', color: '#6b7280', padding: '1rem', background: 'rgba(0, 39, 60, 0.5)', borderRadius: '8px'}}>
                        No ongoing assigned tasks for this date.
                      </p>
                    ) : (
                      getActiveTodos().map(renderAssignedCard)
                    )}
                  </div>

                  <div>
                    <h3 style={{color: '#e8eaed', fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                      <span style={{width: '10px', height: '10px', borderRadius: '50%', background: '#28a745', display: 'inline-block'}} />
                      Done / Completed
                      <span style={{background: 'rgba(40, 167, 69, 0.2)', padding: '0.2rem 0.5rem', borderRadius: '10px', fontSize: '0.8rem', color: '#28a745'}}>
                        {getCompletedTodos().length}
                      </span>
                    </h3>
                    {getCompletedTodos().length === 0 ? (
                      <p style={{textAlign: 'center', color: '#6b7280', padding: '1rem', background: 'rgba(0, 39, 60, 0.5)', borderRadius: '8px'}}>
                        No completed tasks for this date.
                      </p>
                    ) : (
                      getCompletedTodos().map(renderCompletedAssignedCard)
                    )}
                  </div>
                </div>
              ) : (
                /* Other Tabs - Ongoing and Completed split */
                <>
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem'}}>
                    <div>
                      <h3 style={{color: '#e8eaed', fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                        <span style={{width: '10px', height: '10px', borderRadius: '50%', background: '#f5a524', display: 'inline-block'}} />
                        Ongoing Tasks
                        <span style={{background: 'rgba(255, 113, 32, 0.2)', padding: '0.2rem 0.5rem', borderRadius: '10px', fontSize: '0.8rem'}}>
                          {ongoingTodos.length}
                        </span>
                      </h3>
                      {ongoingTodos.length === 0 ? (
                        <p style={{textAlign: 'center', color: '#6b7280', padding: '1rem', background: 'rgba(0, 39, 60, 0.5)', borderRadius: '8px'}}>
                          No ongoing tasks for this date.
                        </p>
                      ) : (
                        ongoingTodos.map(todo => renderStandardCard(todo, false))
                      )}
                    </div>

                    <div>
                      <h3 style={{color: '#e8eaed', fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                        <span style={{width: '10px', height: '10px', borderRadius: '50%', background: '#28a745', display: 'inline-block'}} />
                        Done / Completed
                        <span style={{background: 'rgba(40, 167, 69, 0.2)', padding: '0.2rem 0.5rem', borderRadius: '10px', fontSize: '0.8rem', color: '#28a745'}}>
                          {doneTodos.length}
                        </span>
                      </h3>
                      {doneTodos.length === 0 ? (
                        <p style={{textAlign: 'center', color: '#6b7280', padding: '1rem', background: 'rgba(0, 39, 60, 0.5)', borderRadius: '8px'}}>
                          No completed tasks for this date.
                        </p>
                      ) : (
                        doneTodos.map(todo => renderStandardCard(todo, true))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
        </div>
      </div>

      {/* Create Group Modal */}
      {showGroupModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: '#001824',
            borderRadius: '12px',
            padding: '2rem',
            width: '100%',
            maxWidth: '400px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <h3 style={{margin: '0 0 1.5rem 0', color: '#e8eaed'}}>Create New Group</h3>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group name..."
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#00273C',
                color: '#e8eaed',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                fontSize: '0.9rem',
                marginBottom: '1rem'
              }}
            />
            <textarea
              value={newGroupDesc}
              onChange={(e) => setNewGroupDesc(e.target.value)}
              placeholder="Description (optional)..."
              rows={3}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#00273C',
                color: '#e8eaed',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                fontSize: '0.9rem',
                marginBottom: '1rem',
                resize: 'vertical'
              }}
            />
            <div style={{display: 'flex', gap: '0.5rem'}}>
              <button
                onClick={createGroup}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#FF7120',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Create
              </button>
              <button
                onClick={() => setShowGroupModal(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: 'transparent',
                  color: '#e8eaed',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Groups Modal */}
      {showManageGroupModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: '#001824',
            borderRadius: '12px',
            padding: '2rem',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <h3 style={{margin: '0 0 1.5rem 0', color: '#e8eaed'}}>Manage Groups</h3>
            
            {groups.map(group => (
              <div key={group.id} style={{
                background: '#00273C',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                  <div>
                    <h4 style={{margin: 0, color: '#e8eaed'}}>{group.name}</h4>
                    <p style={{margin: '0.25rem 0 0 0', color: '#6b7280', fontSize: '0.85rem'}}>
                      Leader: {group.leader?.full_name || 'None'}
                    </p>
                  </div>
                  {(isCoordinator || group.leader_id === userProfile?.id) && (
                    <button
                      onClick={() => deleteGroup(group.id)}
                      style={{
                        background: 'rgba(255, 80, 80, 0.1)',
                        border: '1px solid rgba(255, 80, 80, 0.3)',
                        color: '#ff5050',
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      🗑️ Delete Group
                    </button>
                  )}
                </div>
                
                <div style={{marginBottom: '1rem'}}>
                  <p style={{color: '#e8eaed', fontSize: '0.85rem', marginBottom: '0.5rem'}}>Members ({group.members?.length || 0}):</p>
                  <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem'}}>
                    {group.members?.map(member => (
                      <span key={member.user?.id} style={{
                        background: 'rgba(255, 113, 32, 0.1)',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '16px',
                        fontSize: '0.8rem',
                        color: '#e8eaed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        {member.user?.full_name}
                        {(isCoordinator || group.leader_id === userProfile?.id) && (
                          <button
                            onClick={() => removeMemberFromGroup(group.id, member.user?.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ff6b6b',
                              cursor: 'pointer',
                              padding: 0,
                              fontSize: '0.9rem'
                            }}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                    {(!group.members || group.members.length === 0) && (
                      <span style={{color: '#6b7280', fontSize: '0.85rem'}}>No members yet</span>
                    )}
                  </div>
                </div>
                
                {(isCoordinator || group.leader_id === userProfile?.id) && availableUsers.length > 0 && (
                  <div style={{display: 'flex', gap: '0.5rem'}}>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          addMemberToGroup(group.id, e.target.value);
                          e.target.value = '';
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        background: '#001824',
                        color: '#e8eaed',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        fontSize: '0.85rem'
                      }}
                    >
                      <option value="">Add member...</option>
                      {availableUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.full_name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
            
            <button
              onClick={() => setShowManageGroupModal(false)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'transparent',
                color: '#e8eaed',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                marginTop: '0.5rem'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Manage Leaders Modal (Coordinators only) */}
      {showLeaderModal && isCoordinator && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: '#001824',
            borderRadius: '12px',
            padding: '2rem',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflow: 'auto',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <h3 style={{margin: '0 0 1.5rem 0', color: '#e8eaed'}}>👑 Manage Leaders</h3>
            <p style={{color: '#6b7280', marginBottom: '1rem', fontSize: '0.85rem'}}>
              Assign or remove leader status from interns. Leaders can create groups and assign tasks.
            </p>
            
            {interns.map(intern => (
              <div key={intern.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 1rem',
                background: '#00273C',
                borderRadius: '8px',
                marginBottom: '0.5rem',
                border: `1px solid ${intern.is_leader ? 'rgba(255, 193, 7, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`
              }}>
                <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                  {intern.is_leader && <span>👑</span>}
                  <span style={{color: '#e8eaed'}}>{intern.full_name}</span>
                </div>
                <button
                  onClick={() => toggleLeader(intern.id, intern.is_leader)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: intern.is_leader ? 'transparent' : '#FF7120',
                    color: intern.is_leader ? '#ff6b6b' : 'white',
                    border: intern.is_leader ? '1px solid #ff6b6b' : 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  {intern.is_leader ? 'Remove Leader' : 'Make Leader'}
                </button>
              </div>
            ))}
            
            {interns.length === 0 && (
              <p style={{textAlign: 'center', color: '#6b7280', padding: '2rem'}}>No interns found.</p>
            )}
            
            <button
              onClick={() => setShowLeaderModal(false)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'transparent',
                color: '#e8eaed',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                marginTop: '1rem'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TodoList;
