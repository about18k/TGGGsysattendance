import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { CardSkeleton } from './components/SkeletonLoader';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Icon = ({ name, size = 16, color = 'currentColor', strokeWidth = 1.8 }) => {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="7" r="4" />
          <path d="M5 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" />
        </svg>
      );
    case 'team':
      return (
        <svg {...common}>
          <circle cx="16" cy="9" r="3" />
          <circle cx="8" cy="9" r="3" />
          <path d="M3 20v-1.5C3 16.6 5.2 15 8 15c1.2 0 2.4.3 3.3.9" />
          <path d="M21 20v-1.5C21 16.6 18.8 15 16 15c-1.2 0-2.4.3-3.3.9" />
        </svg>
      );
    case 'clipboard':
      return (
        <svg {...common}>
          <path d="M16 4h-2l-.5-1h-3L10 4H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
          <path d="M9 9h6M9 13h6M9 17h4" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <path d="M5 13l4 4 10-10" />
        </svg>
      );
    case 'checkCircle':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <path d="M4 10h16" />
          <path d="M9 14h2" />
          <path d="M13 14h2" />
          <path d="M9 17h2" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .2-1l-1-1.7a7 7 0 0 0 0-1.6l1-1.7a1.7 1.7 0 0 0-.2-1l-1.1-1.1a1.7 1.7 0 0 0-1-.2l-1.7 1a7 7 0 0 0-1.6 0l-1.7-1a1.7 1.7 0 0 0-1 .2L8 6a1.7 1.7 0 0 0-.2 1l1 1.7a7 7 0 0 0 0 1.6l-1 1.7a1.7 1.7 0 0 0 .2 1l1.1 1.1a1.7 1.7 0 0 0 1 .2l1.7-1a7 7 0 0 0 1.6 0l1.7 1a1.7 1.7 0 0 0 1-.2Z" />
        </svg>
      );
    case 'crown':
      return (
        <svg {...common}>
          <path d="M3 17l2-8 5 5 4-5 3 8H3z" />
          <path d="M3 17h18" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M6 7l1-3h10l1 3" />
          <path d="M5 7v13h14V7" />
        </svg>
      );
    case 'x':
      return (
        <svg {...common}>
          <path d="M6 6l12 12" />
          <path d="M6 18L18 6" />
        </svg>
      );
    default:
      return null;
  }
};

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
  // Team Tab Filters
  const [filterText, setFilterText] = useState('');
  const [filterMember, setFilterMember] = useState('');

  const [deadlineDate, setDeadlineDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmingTodo, setConfirmingTodo] = useState(null);
  const [confirmStartDate, setConfirmStartDate] = useState('');
  const [confirmDeadline, setConfirmDeadline] = useState('');
  const [confirmAssignee, setConfirmAssignee] = useState('');
  const [confirmTask, setConfirmTask] = useState('');
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
      const taskWithDate = `[${selectedDate.toLocaleDateString()}] ${dateTask}`;
      const todoData = {
        task: taskWithDate,
        todo_type: 'personal'
      };

      if (activeTab === 'team') {
        // Team tab: members suggest tasks (submitted as group todo, needs leader confirmation)
        const userGroupId = groups.find(g =>
          g.members?.some(m => m.user?.id === userProfile?.id) || g.leader_id === userProfile?.id
        )?.id;

        if (userGroupId) {
          todoData.todo_type = 'group';
          todoData.group_id = userGroupId;
        }
      } else if (activeTab === 'group' && isLeader) {
        // Group tab (Manage): leader creates assigned tasks with dates
        const leaderGroupId = groups.find(g => g.leader_id === userProfile?.id)?.id;

        if (selectedAssignee) {
          todoData.todo_type = 'assigned';
          todoData.assigned_to = selectedAssignee;
        } else if (leaderGroupId) {
          todoData.todo_type = 'group';
          todoData.group_id = leaderGroupId;
        }
      }

      // Add dates if they exist (for Personal and Manage tabs)
      if (selectedDate) {
        todoData.start_date = selectedDate.toISOString().split('T')[0];
      }
      if (deadlineDate) {
        todoData.deadline = deadlineDate.toISOString().split('T')[0];
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

  const openConfirmModal = (todo) => {
    setConfirmingTodo(todo);
    setConfirmTask(todo.task.replace(/\[.*?\]\s*/, '')); // Remove date prefix
    setConfirmStartDate(new Date().toISOString().split('T')[0]);
    setConfirmDeadline('');
    setConfirmAssignee('');
    setShowConfirmModal(true);
  };

  const submitConfirmTodo = async () => {
    if (!confirmingTodo) return;
    try {
      await axios.post(`${API}/todos/${confirmingTodo.id}/confirm`, {
        task: `[${selectedDate.toLocaleDateString()}] ${confirmTask}`,
        start_date: confirmStartDate || null,
        deadline: confirmDeadline || null,
        assigned_to: confirmAssignee || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowConfirmModal(false);
      setConfirmingTodo(null);
      fetchTodos(activeTab);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to confirm task.');
    }
  };

  const confirmTodo = async (id) => {
    // Legacy function - now we use openConfirmModal for group todos
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
    let filtered = todos;

    // Only apply date filter for non-Team tabs
    if (activeTab !== 'team') {
      const dateStr = selectedDate.toLocaleDateString();
      filtered = filtered.filter(todo => todo.task.includes(`[${dateStr}]`));
    }

    // For group tab, filter by selected group OR include assigned tasks (which don't have group_id)
    if (activeTab === 'group' && selectedGroup) {
      filtered = filtered.filter(todo =>
        todo.group_id === selectedGroup || todo.todo_type === 'assigned'
      );
    }

    // Apply Team Tab Filters
    if (activeTab === 'team') {
      if (filterText) {
        const lowerFilter = filterText.toLowerCase();
        filtered = filtered.filter(todo => todo.task.toLowerCase().includes(lowerFilter));
      }
      if (filterMember) {
        filtered = filtered.filter(todo =>
          (todo.assignee?.id && String(todo.assignee.id) === String(filterMember)) ||
          (todo.suggester?.id && String(todo.suggester.id) === String(filterMember))
        );
      }
    }

    return filtered;
  };

  const canAddTodo = () => {
    if (activeTab === 'personal') return true;
    // Team tab: only members can suggest tasks (leaders use Manage tab)
    if (activeTab === 'team') return !isLeader && groups.length > 0;
    // Group tab (Manage): only leaders can add/assign tasks
    if (activeTab === 'group') return isLeader && leaderHasGroup;
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Icon
          name={todo.pending_completion ? 'clock' : 'clipboard'}
          size={16}
          color={todo.pending_completion ? '#ffa500' : '#6aa9ff'}
          strokeWidth={2}
        />
        <span style={{
          flex: 1,
          color: todo.pending_completion ? '#ffa500' : '#e8eaed',
          fontSize: '0.95rem',
          wordBreak: 'break-word'
        }}>
          {todo.task.replace(/\[.*?\]\s*/, '')}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
        {todo.todo_type === 'group' && todo.group && (
          <span style={{ background: 'rgba(255, 113, 32, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
            Group: {todo.group.name}
          </span>
        )}
        {todo.todo_type === 'group' && todo.suggester && (
          <span style={{ background: 'rgba(100, 100, 255, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
            Suggested by: {todo.suggester.full_name}
          </span>
        )}
        {todo.todo_type === 'assigned' && todo.assignee && (
          <span style={{ background: 'rgba(100, 255, 100, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
            Assigned to: {todo.assignee.full_name}
          </span>
        )}
        {todo.todo_type === 'assigned' && todo.assigner && (
          <span style={{ background: 'rgba(255, 100, 100, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
            Assigned by: {todo.assigner.full_name}
          </span>
        )}
        {todo.date_assigned && (
          <span style={{ background: 'rgba(150, 150, 150, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
            Date: {new Date(todo.date_assigned).toLocaleDateString()}
          </span>
        )}
        {todo.pending_completion && (
          <span style={{ background: 'rgba(255, 165, 0, 0.2)', padding: '0.25rem 0.5rem', borderRadius: '4px', color: '#ffa500' }}>
            Pending Approval
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center', width: '100%' }}>
                <Icon name="check" size={14} color="white" strokeWidth={2} />
                Complete
              </span>
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center', width: '100%' }}>
                <Icon name="x" size={14} color="#ffa500" strokeWidth={2} />
                Cancel
              </span>
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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center', width: '100%' }}>
              <Icon name="check" size={14} color="white" strokeWidth={2} />
              Complete
            </span>
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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center', width: '100%' }}>
              <Icon name="check" size={14} color="white" strokeWidth={2} />
              Mark Complete
            </span>
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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center', width: '100%' }}>
              <Icon name="x" size={14} color="#ffa500" strokeWidth={2} />
              Cancel
            </span>
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center', width: '100%' }}>
                  <Icon name="check" size={14} color="white" strokeWidth={2} />
                  Complete
                </span>
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center', width: '100%' }}>
                  <Icon name="x" size={14} color="#ff5050" strokeWidth={2} />
                  Reject
                </span>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Icon name="checkCircle" size={16} color="#28a745" strokeWidth={2} />
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
        <span style={{ background: 'rgba(150, 150, 150, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
          Date: {new Date(todo.date_assigned || todo.created_at).toLocaleDateString()}
        </span>
        {todo.todo_type === 'group' && todo.group && (
          <span style={{ background: 'rgba(255, 113, 32, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
            Group: {todo.group.name}
          </span>
        )}
        {todo.todo_type === 'group' && todo.suggester && (
          <span style={{ background: 'rgba(100, 100, 255, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
            Suggested: {todo.suggester.full_name}
          </span>
        )}
        {todo.todo_type === 'group' && todo.suggester && (
          <span style={{ background: 'rgba(100, 255, 100, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
            Completed by: {todo.suggester.full_name}
          </span>
        )}
        {todo.todo_type === 'assigned' && todo.assignee && (
          <span style={{ background: 'rgba(100, 255, 100, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
            Completed by: {todo.assignee.full_name}
          </span>
        )}
        <span style={{ background: 'rgba(40, 167, 69, 0.2)', padding: '0.25rem 0.5rem', borderRadius: '4px', color: '#28a745', fontWeight: '500' }}>
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
        border: `1px solid ${todo.pending_completion ? 'rgba(255, 165, 0, 0.5)' :
          todo.is_confirmed === false ? 'rgba(255, 193, 7, 0.5)' :
            'rgba(255, 255, 255, 0.1)'
          }`,
        opacity: todo.is_confirmed === false ? 0.8 : 1
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Icon
          name={todo.completed ? "checkCircle" : todo.pending_completion ? "clock" : "clipboard"}
          size={18}
          color={todo.completed ? "#28a745" : todo.pending_completion ? "#ffa500" : "#FF7120"}
          strokeWidth={2}
        />
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
        {todo.todo_type === 'assigned' && (
          <span style={{ background: 'rgba(100, 149, 237, 0.2)', padding: '0.25rem 0.5rem', borderRadius: '4px', color: '#6495ED', fontWeight: '500' }}>
            Assigned Task
          </span>
        )}
        {todo.todo_type === 'group' && todo.group && (
          <span style={{ background: 'rgba(255, 113, 32, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
            Group: {todo.group.name}
          </span>
        )}
        {todo.todo_type === 'group' && todo.suggester && (
          <span style={{ background: 'rgba(100, 100, 255, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
            Suggested by: {todo.suggester.full_name}
          </span>
        )}
        {todo.todo_type === 'assigned' && todo.assignee && (
          <span style={{ background: 'rgba(100, 255, 100, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
            Assigned to: {todo.assignee.full_name}
          </span>
        )}
        {todo.todo_type === 'assigned' && todo.assigner && (
          <span style={{ background: 'rgba(255, 100, 100, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
            Assigned by: {todo.assigner.full_name}
          </span>
        )}
        {todo.todo_type === 'assigned' && todo.date_assigned && (
          <span style={{ background: 'rgba(150, 150, 150, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
            Assigned: {new Date(todo.date_assigned).toLocaleDateString()}
          </span>
        )}
        {todo.start_date && (
          <span style={{ background: 'rgba(52, 152, 219, 0.2)', padding: '0.25rem 0.5rem', borderRadius: '4px', color: '#3498db' }}>
            Start: {new Date(todo.start_date).toLocaleDateString()}
          </span>
        )}
        {todo.deadline && (
          <span style={{ background: 'rgba(231, 76, 60, 0.2)', padding: '0.25rem 0.5rem', borderRadius: '4px', color: '#e74c3c' }}>
            Deadline: {new Date(todo.deadline).toLocaleDateString()}
          </span>
        )}
        {todo.is_confirmed === false && (
          <span style={{ background: 'rgba(255, 193, 7, 0.2)', padding: '0.25rem 0.5rem', borderRadius: '4px', color: '#ffc107' }}>
            Pending Confirmation
          </span>
        )}
        {todo.pending_completion && (
          <span style={{ background: 'rgba(255, 165, 0, 0.2)', padding: '0.25rem 0.5rem', borderRadius: '4px', color: '#ffa500' }}>
            Pending Completion Approval
          </span>
        )}
        {todo.todo_type === 'assigned' && todo.completed && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(40, 167, 69, 0.2)', padding: '0.25rem 0.5rem', borderRadius: '4px', color: '#28a745' }}>
            <Icon name="check" size={14} color="#28a745" strokeWidth={2} />
            Completed
          </span>
        )}
      </div>

      {!isCompletedSection && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {activeTab === 'group' && todo.todo_type === 'group' && todo.is_confirmed === false &&
            groups.find(g => g.id === todo.group_id)?.leader_id === userProfile?.id && (
              <button
                onClick={() => openConfirmModal(todo)}
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center', width: '100%' }}>
                  <Icon name="check" size={14} color="white" strokeWidth={2} />
                  Confirm Task
                </span>
              </button>
            )}
          {(
            ((activeTab === 'group' || activeTab === 'team') && todo.todo_type === 'assigned' && todo.assigned_to === userProfile?.id) ||
            (activeTab === 'personal' && todo.todo_type === 'personal')
          ) && !todo.pending_completion && !todo.completed && (
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center', width: '100%' }}>
                  <Icon name="check" size={14} color="white" strokeWidth={2} />
                  Mark Complete
                </span>
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center', width: '100%' }}>
                  <Icon name="x" size={14} color="#ffa500" strokeWidth={2} />
                  Cancel
                </span>
              </button>
            )}
          {activeTab === 'group' && todo.todo_type === 'assigned' && todo.pending_completion &&
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center', width: '100%' }}>
                  <Icon name="check" size={14} color="white" strokeWidth={2} />
                  Confirm Completion
                </span>
              </button>
            )}
          {activeTab === 'group' && todo.todo_type === 'assigned' && todo.pending_completion &&
            (todo.assigned_by === userProfile?.id || isCoordinator) && (
              <button
                onClick={() => rejectCompletion(todo.id)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  color: '#ef4444',
                  padding: '0.65rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center', width: '100%' }}>
                  <Icon name="x" size={14} color="#ef4444" strokeWidth={2} />
                  Reject
                </span>
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
    { id: 'personal', label: 'Personal', icon: 'user' },
    { id: 'team', label: 'Team', icon: 'team' },
    // Group tab only visible to leaders - shows pending suggestions and pending completions
    ...(isLeader ? [{ id: 'group', label: 'Manage', icon: 'clipboard' }] : [])
  ];

  const currentGroup = groups.find(g => g.id === selectedGroup);
  const activeTabConfig = tabs.find(t => t.id === activeTab) || tabs[0];

  return (
    <div className="dashboard" style={{ overflowX: 'hidden' }}>
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
        <div style={{ display: 'flex', flex: '1 1 auto', gap: '0.5rem', flexWrap: 'wrap' }}>
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
              <Icon name={tab.icon} size={16} color={activeTab === tab.id ? 'white' : '#a0a4a8'} strokeWidth={1.6} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Management Buttons for Leaders - shown only on Group (Manage) tab */}
      {isLeader && activeTab === 'group' && (
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
              <Icon name="plus" size={16} color="#FF7120" />
              Create Group
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

              Manage Groups
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
              <Icon name="crown" size={16} color="#FF7120" />
              Manage Leaders
            </button>
          )}
        </div>
      )}

      <div className="todo-layout" style={{ display: 'flex', gap: '1.5rem', alignItems: 'stretch', flexWrap: 'wrap', maxWidth: '100%' }}>
        <div className="welcome todo-sidebar" style={{ flex: '1 1 300px', maxWidth: '350px', order: 1, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <h2 style={{ margin: 0 }}>
              {activeTabConfig.label} Todo List
            </h2>
            <button
              onClick={() => setShowCalendar(s => !s)}
              title="Toggle calendar"
              aria-label="Toggle calendar"
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
              <Icon name="calendar" size={20} color="#FF7120" strokeWidth={2} />
            </button>
          </div>
          <p style={{ marginBottom: '1rem' }}>
            {activeTab === 'personal' && 'Your private tasks - only you can see these'}
            {activeTab === 'team' && 'Team tasks - ongoing and completed tasks from your group'}
            {activeTab === 'group' && 'Manage pending suggestions and task completions'}
          </p>

          {showCalendar && (
            <div className="checkin-form todo-calendar" style={{ marginBottom: '1rem', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Icon name="calendar" size={22} color="#FF7120" strokeWidth={2.2} />
                  Calendar
                </h3>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button onClick={() => changeMonth(-1)} style={{ background: 'transparent', border: '1px solid rgba(255, 113, 32, 0.3)', color: '#FF7120', padding: '0.35rem 0.7rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>‹</button>
                  <button onClick={() => changeMonth(1)} style={{ background: 'transparent', border: '1px solid rgba(255, 113, 32, 0.3)', color: '#FF7120', padding: '0.35rem 0.7rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>›</button>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                <span style={{ color: '#e8eaed', fontSize: '0.95rem', fontWeight: '500' }}>{monthName}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.3rem', marginBottom: '0.5rem' }}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                  <div key={day} style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.75rem', padding: '0.3rem', fontWeight: '600' }}>{day}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.3rem' }}>
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

          {/* Message for leaders without groups */}
          {activeTab === 'group' && isLeader && !leaderHasGroup && (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              background: 'rgba(255, 113, 32, 0.1)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 113, 32, 0.3)',
              marginBottom: '1rem'
            }}>
              <Icon name="team" size={48} color="#FF7120" strokeWidth={1.5} />
              <h3 style={{ margin: '1rem 0 0.5rem', color: '#e8eaed' }}>Create a Group</h3>
              <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                You need to create a group before you can manage team tasks.
              </p>
              <button
                onClick={() => { setShowGroupModal(true); fetchAvailableUsers(); }}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#FF7120',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '600'
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Icon name="plus" size={16} color="white" />
                  Create Group
                </span>
              </button>
            </div>
          )}



          {activeTab !== 'team' && (
            <div style={{ marginTop: 'auto', padding: '1rem', background: 'rgba(255, 113, 32, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 113, 32, 0.2)' }}>
              <p style={{ fontSize: '0.85rem', color: '#e8eaed', marginBottom: '0.5rem' }}>
                {activeTab === 'personal' && 'These tasks are private to you.'}
                {activeTab === 'group' && 'Team members can suggest tasks; leaders confirm before work starts.'}
              </p>
            </div>
          )}

          {/* Group Info for Team Tab */}
          {activeTab === 'team' && groups.length > 0 && (() => {
            const userGroup = groups.find(g =>
              g.members?.some(m => m.user?.id === userProfile?.id) || g.leader_id === userProfile?.id
            );
            if (!userGroup) return null;
            return (
              <div style={{
                marginBottom: '1rem',
                padding: '1rem',
                background: '#00273C',
                borderRadius: '12px',
                border: '1px solid rgba(255, 113, 32, 0.3)'
              }}>
                {/* Group Name Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.75rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <Icon name="team" size={22} color="#FF7120" strokeWidth={2} />
                  <span style={{ fontSize: '1.15rem', color: '#FF7120', fontWeight: '700' }}>
                    {userGroup.name}
                  </span>
                </div>

                {/* Description */}
                {userGroup.description && (
                  <p style={{
                    fontSize: '0.9rem',
                    color: '#a0a4a8',
                    margin: '0 0 1rem 0',
                    fontStyle: 'italic',
                    lineHeight: '1.4'
                  }}>
                    "{userGroup.description}"
                  </p>
                )}

                {/* Leader */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.75rem'
                }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.35rem 0.6rem',
                    borderRadius: '6px',
                    color: '#ffc107',
                    fontSize: '0.8rem',
                    fontWeight: '500'
                  }}>
                    Leader:
                  </span>
                  <span style={{ color: '#e8eaed', fontSize: '0.9rem' }}>
                    {userGroup.leader?.full_name || 'None'}
                  </span>
                </div>

                {/* Members */}
                <div>
                  <p style={{
                    fontSize: '0.8rem',
                    color: '#6b7280',
                    margin: '0 0 0.5rem 0',
                    fontWeight: '500'
                  }}>
                    Team Members ({userGroup.members?.length || 0})
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {userGroup.members?.map(m => (
                      <span
                        key={m.user?.id || m.id}
                        style={{
                          background: 'rgba(100, 149, 237, 0.15)',
                          padding: '0.3rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          color: '#6495ED'
                        }}
                      >
                        {m.user?.full_name || 'Unknown'}
                      </span>
                    ))}
                    {(!userGroup.members || userGroup.members.length === 0) && (
                      <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>No members yet</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Suggest Task form - only for members in Team tab or for adding in other tabs */}
          {(activeTab !== 'team' || !isLeader) && (
            <div className="checkin-form" style={{ marginTop: '1rem', padding: '1rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
                {activeTab === 'team' ? 'Suggest Task' : 'Add Task'}
              </h3>
              {canAddTodo() ? (
                <form onSubmit={addDateTodo} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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

                  {activeTab === 'group' && (
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

                  {(activeTab === 'group' || activeTab === 'personal') && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                        <label style={{ display: 'block', marginBottom: '0.35rem', color: '#e8eaed', fontSize: '0.8rem' }}>Start Date</label>
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
                      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                        <label style={{ display: 'block', marginBottom: '0.35rem', color: '#e8eaed', fontSize: '0.8rem' }}>Deadline</label>
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

                  <button type="submit" className="todo-add-btn" style={{ width: '100%', padding: '0.75rem' }}>
                    {activeTab === 'team' ? 'Suggest Task' : activeTab === 'group' ? 'Assign Task' : 'Add Task'}
                  </button>
                </form>
              ) : (
                <div style={{ padding: '0.75rem', background: 'rgba(255, 113, 32, 0.1)', borderRadius: '6px', border: '1px solid rgba(255, 113, 32, 0.2)' }}>
                  <p style={{ margin: 0, color: '#e8eaed', fontSize: '0.9rem' }}>
                    {activeTab === 'group' && (isLeader || isCoordinator) && 'Leaders assign tasks via the Group tab.'}
                    {activeTab === 'group' && !isLeader && !isCoordinator && 'You need to be in a group to add group tasks.'}
                    {activeTab === 'assigned' && 'Only leaders and coordinators can assign tasks.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Calendar card removed from center; calendar lives in the sidebar via icon toggle */}

        <div className="checkin-form todo-main" style={{ flex: '1 1 500px', order: 3, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', maxHeight: '650px', overflow: 'hidden' }}>
          {loading ? (
            <CardSkeleton />
          ) : (
            <>
              <h3 style={{ flexShrink: 0 }}>Tasks for {selectedDate.toLocaleDateString()}</h3>

              {/* Team Tab Filter Bar */}
              {activeTab === 'team' && (
                <div style={{
                  background: '#001f35',
                  padding: '1rem',
                  marginBottom: '1rem',
                  borderRadius: '12px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                  alignItems: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  {/* Search Task */}
                  <input
                    type="text"
                    placeholder="Search tasks..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      background: '#001219',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#e8eaed',
                      fontSize: '0.9rem',
                      height: '42px',
                      boxSizing: 'border-box'
                    }}
                  />

                  {/* Filter Member */}
                  <div style={{ position: 'relative', width: '100%' }}>
                    <select
                      value={filterMember}
                      onChange={(e) => setFilterMember(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        background: '#001219',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#e8eaed',
                        fontSize: '0.9rem',
                        appearance: 'none',
                        cursor: 'pointer',
                        height: '42px',
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="">All Members</option>
                      {(() => {
                        const allUsers = groups.flatMap(g => {
                          const members = (g.members || []).map(m => m.user);
                          if (g.leader) members.push(g.leader);
                          return members;
                        });
                        const uniqueUsers = allUsers.filter((u, i, self) => u && self.findIndex(t => t.id === u.id) === i);

                        return uniqueUsers.map(user => (
                          <option key={user.id} value={user.id}>{user.full_name}</option>
                        ));
                      })()}
                    </select>
                    <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.5 }}>
                      <Icon name="chevronDown" size={14} color="#a0a4a8" />
                    </div>
                  </div>
                </div>
              )}

              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                {activeTab === 'assigned' ? (
                  /* Assigned Tab - Ongoing and Completed */
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                    <div>
                      <h3 style={{ color: '#e8eaed', fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Icon name="clock" size={16} color="#5ecda5" strokeWidth={2} />
                        Ongoing Tasks
                        <span style={{ background: 'rgba(255, 113, 32, 0.2)', padding: '0.2rem 0.5rem', borderRadius: '10px', fontSize: '0.8rem' }}>
                          {getActiveTodos().length}
                        </span>
                      </h3>
                      {getActiveTodos().length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#6b7280', padding: '1rem', background: 'rgba(0, 39, 60, 0.5)', borderRadius: '8px' }}>
                          No ongoing assigned tasks for this date.
                        </p>
                      ) : (
                        getActiveTodos().map(renderAssignedCard)
                      )}
                    </div>

                    <div>
                      <h3 style={{ color: '#e8eaed', fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Icon name="checkCircle" size={16} color="#28a745" strokeWidth={2} />
                        Done / Completed
                        <span style={{ background: 'rgba(40, 167, 69, 0.2)', padding: '0.2rem 0.5rem', borderRadius: '10px', fontSize: '0.8rem', color: '#28a745' }}>
                          {getCompletedTodos().length}
                        </span>
                      </h3>
                      {getCompletedTodos().length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#6b7280', padding: '1rem', background: 'rgba(0, 39, 60, 0.5)', borderRadius: '8px' }}>
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                      <div>
                        <h3 style={{
                          color: '#e8eaed',
                          fontSize: '1rem',
                          marginBottom: '1rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          position: 'sticky',
                          top: 0,
                          zIndex: 10,
                          background: '#001f35',
                          padding: '1rem 0'
                        }}>
                          <Icon name="clock" size={16} color="#f5a524" strokeWidth={2} />
                          {activeTab === 'group' ? 'Pending Tasks' : 'Ongoing Tasks'}
                          <span style={{ background: 'rgba(255, 113, 32, 0.2)', padding: '0.2rem 0.5rem', borderRadius: '10px', fontSize: '0.8rem' }}>
                            {ongoingTodos.length}
                          </span>
                        </h3>
                        {ongoingTodos.length === 0 ? (
                          <p style={{ textAlign: 'center', color: '#6b7280', padding: '1rem', background: 'rgba(0, 39, 60, 0.5)', borderRadius: '8px' }}>
                            No ongoing tasks for this date.
                          </p>
                        ) : (
                          ongoingTodos.map(todo => renderStandardCard(todo, false))
                        )}
                      </div>

                      <div>
                        {activeTab === 'group' ? (
                          /* Manage Tab - Member Stats */
                          <>
                            <h3 style={{
                              color: '#e8eaed',
                              fontSize: '1rem',
                              marginBottom: '1rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              position: 'sticky',
                              top: 0,
                              zIndex: 10,
                              background: '#001f35',
                              padding: '1rem 0'
                            }}>
                              <Icon name="team" size={16} color="#6495ED" strokeWidth={2} />
                              Member Task Stats
                            </h3>
                            {(() => {
                              const leaderGroup = groups.find(g => g.leader_id === userProfile?.id);
                              if (!leaderGroup || !leaderGroup.members || leaderGroup.members.length === 0) {
                                return (
                                  <p style={{ textAlign: 'center', color: '#6b7280', padding: '1rem', background: 'rgba(0, 39, 60, 0.5)', borderRadius: '8px' }}>
                                    No members in your group.
                                  </p>
                                );
                              }

                              // Calculate stats per member - filter by tasks assigned by this leader
                              // Include leader in stats
                              const allMembers = [
                                { user: leaderGroup.leader || userProfile },
                                ...(leaderGroup.members || [])
                              ].filter(m => m.user); // safety check

                              const memberStats = allMembers.map(member => {
                                const memberTodos = todos.filter(t =>
                                  t.todo_type === 'assigned' &&
                                  t.assigned_to === member.user?.id &&
                                  t.assigned_by === userProfile?.id
                                );
                                return {
                                  id: member.user?.id,
                                  name: member.user?.full_name || 'Unknown',
                                  total: memberTodos.length,
                                  completed: memberTodos.filter(t => t.completed).length,
                                  pending: memberTodos.filter(t => t.pending_completion).length,
                                  ongoing: memberTodos.filter(t => !t.completed && !t.pending_completion && t.is_confirmed).length
                                };
                              });

                              return memberStats.map(member => (
                                <div
                                  key={member.id}
                                  style={{
                                    padding: '0.75rem',
                                    background: '#00273C',
                                    borderRadius: '8px',
                                    marginBottom: '0.5rem',
                                    border: '1px solid rgba(255, 255, 255, 0.1)'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <span style={{ color: '#e8eaed', fontWeight: '500' }}>{member.name}</span>
                                    <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{member.ongoing} new</span>
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <span style={{
                                      background: 'rgba(40, 167, 69, 0.2)',
                                      padding: '0.2rem 0.5rem',
                                      borderRadius: '4px',
                                      fontSize: '0.75rem',
                                      color: '#28a745'
                                    }}>
                                      {member.completed} done
                                    </span>
                                    <span style={{
                                      background: 'rgba(255, 165, 0, 0.2)',
                                      padding: '0.2rem 0.5rem',
                                      borderRadius: '4px',
                                      fontSize: '0.75rem',
                                      color: '#ffa500'
                                    }}>
                                      {member.pending} pending
                                    </span>
                                    <span style={{
                                      background: 'rgba(255, 113, 32, 0.2)',
                                      padding: '0.2rem 0.5rem',
                                      borderRadius: '4px',
                                      fontSize: '0.75rem',
                                      color: '#FF7120'
                                    }}>
                                      {member.ongoing} ongoing
                                    </span>
                                  </div>
                                </div>
                              ));
                            })()}
                          </>
                        ) : (
                          /* Other Tabs - Done/Completed */
                          <>
                            <h3 style={{
                              color: '#e8eaed',
                              fontSize: '1rem',
                              marginBottom: '1rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              position: 'sticky',
                              top: 0,
                              zIndex: 10,
                              background: '#001f35',
                              padding: '1rem 0'
                            }}>
                              <Icon name="checkCircle" size={16} color="#28a745" strokeWidth={2} />
                              Done / Completed
                              <span style={{ background: 'rgba(40, 167, 69, 0.2)', padding: '0.2rem 0.5rem', borderRadius: '10px', fontSize: '0.8rem', color: '#28a745' }}>
                                {doneTodos.length}
                              </span>
                            </h3>
                            {doneTodos.length === 0 ? (
                              <p style={{ textAlign: 'center', color: '#6b7280', padding: '1rem', background: 'rgba(0, 39, 60, 0.5)', borderRadius: '8px' }}>
                                No completed tasks for this date.
                              </p>
                            ) : (
                              doneTodos.map(todo => renderStandardCard(todo, true))
                            )}
                          </>
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
            <h3 style={{ margin: '0 0 1.5rem 0', color: '#e8eaed' }}>Create New Group</h3>
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
            <div style={{ display: 'flex', gap: '0.5rem' }}>
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
            <h3 style={{ margin: '0 0 1.5rem 0', color: '#e8eaed' }}>Manage Groups</h3>

            {groups.map(group => (
              <div key={group.id} style={{
                background: '#00273C',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h4 style={{ margin: 0, color: '#e8eaed' }}>{group.name}</h4>
                    <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
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
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Icon name="trash" size={14} color="#ff5050" strokeWidth={2} />
                        Delete Group
                      </span>
                    </button>
                  )}
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ color: '#e8eaed', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Members ({group.members?.length || 0}):</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
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
                      <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>No members yet</span>
                    )}
                  </div>
                </div>

                {(isCoordinator || group.leader_id === userProfile?.id) && availableUsers.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
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
            <h3 style={{ margin: '0 0 1.5rem 0', color: '#e8eaed', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Icon name="crown" size={16} color="#ffc107" strokeWidth={2} />
              Manage Leaders
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '0.85rem' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {intern.is_leader && <Icon name="crown" size={14} color="#ffc107" strokeWidth={2} />}
                  <span style={{ color: '#e8eaed' }}>{intern.full_name}</span>
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
              <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>No interns found.</p>
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

      {/* Confirm Suggestion Modal */}
      {showConfirmModal && confirmingTodo && (
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
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '500px',
            width: '100%',
            border: '1px solid rgba(255, 113, 32, 0.3)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#e8eaed' }}>
              <Icon name="check" size={24} color="#FF7120" strokeWidth={2} />
              Confirm Task
            </h2>

            {confirmingTodo.suggester && (
              <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Suggested by: <span style={{ color: '#FF7120' }}>{confirmingTodo.suggester.full_name}</span>
              </p>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#e8eaed', fontSize: '0.85rem' }}>
                Task Description
              </label>
              <textarea
                value={confirmTask}
                onChange={(e) => setConfirmTask(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#00273C',
                  color: '#e8eaed',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  minHeight: '80px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#e8eaed', fontSize: '0.85rem' }}>
                Start Date
              </label>
              <input
                type="date"
                value={confirmStartDate}
                onChange={(e) => setConfirmStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#00273C',
                  color: '#e8eaed',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#e8eaed', fontSize: '0.85rem' }}>
                Deadline
              </label>
              <input
                type="date"
                value={confirmDeadline}
                onChange={(e) => setConfirmDeadline(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#00273C',
                  color: '#e8eaed',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#e8eaed', fontSize: '0.85rem' }}>
                Assign To
              </label>
              <select
                value={confirmAssignee}
                onChange={(e) => setConfirmAssignee(e.target.value)}
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
                <option value="">-- Select Assignee (Optional) --</option>
                {getGroupMembersForAssign().map(member => (
                  <option key={member.id} value={member.id}>{member.full_name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={submitConfirmTodo}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '600'
                }}
              >
                Confirm & Assign
              </button>
              <button
                onClick={() => { setShowConfirmModal(false); setConfirmingTodo(null); }}
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
    </div>
  );
}

export default TodoList;
