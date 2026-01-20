import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Alert from './components/Alert';
import { CardSkeleton } from './components/SkeletonLoader';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function TodoList({ token }) {
  const [todos, setTodos] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateTask, setDateTask] = useState('');
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const itemsPerPage = 5;

  useEffect(() => {
    fetchTodos();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate]);

  const fetchTodos = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/todos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTodos(data);
    } finally {
      setLoading(false);
    }
  };

  const addDateTodo = async (e) => {
    e.preventDefault();
    if (!dateTask.trim()) return;
    
    try {
      const taskWithDate = `[${selectedDate.toLocaleDateString()}] ${dateTask}`;
      await axios.post(`${API}/todos`, { task: taskWithDate }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDateTask('');
      await fetchTodos();
    } catch (error) {
      console.error('Error adding task:', error);
      setAlert({ type: 'error', title: 'Error', message: 'Failed to add task. Please make sure the todos table exists in Supabase.' });
    }
  };

  const toggleTodo = async (id, completed) => {
    await axios.put(`${API}/todos/${id}`, { completed: !completed }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    fetchTodos();
  };

  const deleteTodo = async (id) => {
    await axios.delete(`${API}/todos/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    fetchTodos();
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
    return todos.filter(todo => todo.task.includes(`[${dateStr}]`));
  };

  const filteredTodos = getFilteredTodos();
  const { firstDay, daysInMonth } = getDaysInMonth(selectedDate);
  const monthName = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <>
      {alert && (
        <Alert
          type={alert.type}
          title={alert.title}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}
    <div className="dashboard" style={{overflowX: 'hidden'}}>
      <div className="todo-layout" style={{display: 'flex', gap: '1.5rem', alignItems: 'stretch', flexWrap: 'wrap', maxWidth: '100%'}}>
        <div className="welcome todo-sidebar" style={{flex: '1 1 300px', maxWidth: '350px', order: 1, boxSizing: 'border-box', display: 'flex', flexDirection: 'column'}}>
          <h2>My Todo List</h2>
          <p>Keep track of your daily tasks</p>
          <div style={{marginTop: '1rem', padding: '1rem', background: 'rgba(255, 113, 32, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 113, 32, 0.2)', flex: 1}}>
            <p style={{fontSize: '0.85rem', color: '#e8eaed', marginBottom: '0.5rem'}}>
              Select a date from the calendar to view and manage tasks for that day.
            </p>
            <p style={{fontSize: '0.85rem', color: '#e8eaed', marginBottom: '0.5rem'}}>
              Check off completed tasks to track your progress.
            </p>
            <p style={{fontSize: '0.85rem', color: '#e8eaed', marginBottom: '0'}}>
              Delete tasks you no longer need.
            </p>
          </div>

          <div className="checkin-form" style={{marginTop: '1rem', padding: '1rem'}}>
            <h3 style={{fontSize: '1rem', marginBottom: '0.75rem'}}>GitHub Issues</h3>
            <p style={{fontSize: '0.85rem', color: '#e8eaed', marginBottom: '1rem'}}>
              Check or add issues to the project repository
            </p>
            <button
              onClick={() => window.open('https://github.com/demesis221/TGGGsysattendance/issues', '_blank')}
              style={{
                width: '100%',
                background: '#FF7120',
                color: 'white',
                border: 'none',
                padding: '0.75rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <span>↗</span>
              View GitHub Issues
            </button>
          </div>
        </div>

        <div className="checkin-form todo-calendar" style={{flex: '1 1 300px', maxWidth: '400px', order: 2, boxSizing: 'border-box', overflow: 'hidden', display: 'flex', flexDirection: 'column'}}>
          <h3>Calendar</h3>
          <div style={{marginBottom: '1rem', width: '100%', overflow: 'hidden'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
              <button onClick={() => changeMonth(-1)} style={{background: 'transparent', border: '1px solid rgba(255, 113, 32, 0.3)', color: '#FF7120', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem'}}>‹</button>
              <span style={{color: '#e8eaed', fontSize: '0.95rem', fontWeight: '500'}}>{monthName}</span>
              <button onClick={() => changeMonth(1)} style={{background: 'transparent', border: '1px solid rgba(255, 113, 32, 0.3)', color: '#FF7120', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem'}}>›</button>
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
        </div>

        <div className="checkin-form todo-main" style={{flex: '1 1 400px', order: 3, boxSizing: 'border-box'}}>
        {loading ? (
          <CardSkeleton />
        ) : (
          <>
            <h3>Tasks for {selectedDate.toLocaleDateString()}</h3>
            <form onSubmit={addDateTodo} className="todo-form" style={{display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem'}}>
              <input
                type="text"
                value={dateTask}
                onChange={(e) => setDateTask(e.target.value)}
                placeholder="Enter your task..."
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
              <button type="submit" className="todo-add-btn" style={{width: '100%', padding: '0.75rem'}}>Add Task</button>
            </form>

            <div>
              {filteredTodos.length === 0 ? (
                <p style={{textAlign: 'center', color: '#6b7280', padding: '2rem'}}>
                  No tasks for this date. Add your first task above!
                </p>
              ) : (
                <>
                {filteredTodos.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(todo => (
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
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
                      <input
                        type="checkbox"
                        checked={todo.completed}
                        onChange={() => toggleTodo(todo.id, todo.completed)}
                        style={{
                          width: '20px',
                          height: '20px',
                          cursor: 'pointer',
                          accentColor: '#FF7120',
                          flexShrink: 0
                        }}
                      />
                      <span
                        style={{
                          flex: 1,
                          color: todo.completed ? '#6b7280' : '#e8eaed',
                          textDecoration: todo.completed ? 'line-through' : 'none',
                          fontSize: '0.95rem',
                          wordBreak: 'break-word'
                        }}
                      >
                        {todo.task.replace(/\[.*?\]\s*/, '')}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255, 113, 32, 0.3)',
                        color: '#FF7120',
                        padding: '0.65rem 1rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        width: '100%'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
                {filteredTodos.length > itemsPerPage && (
                  <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem'}}>
                    <div style={{display: 'flex', gap: '0.5rem'}}>
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        style={{
                          flex: 1,
                          background: currentPage === 1 ? 'transparent' : '#FF7120',
                          color: currentPage === 1 ? '#6b7280' : 'white',
                          border: '1px solid rgba(255, 113, 32, 0.3)',
                          padding: '0.65rem 1rem',
                          borderRadius: '6px',
                          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                          fontSize: '0.85rem'
                        }}
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredTodos.length / itemsPerPage), p + 1))}
                        disabled={currentPage === Math.ceil(filteredTodos.length / itemsPerPage)}
                        style={{
                          flex: 1,
                          background: currentPage === Math.ceil(filteredTodos.length / itemsPerPage) ? 'transparent' : '#FF7120',
                          color: currentPage === Math.ceil(filteredTodos.length / itemsPerPage) ? '#6b7280' : 'white',
                          border: '1px solid rgba(255, 113, 32, 0.3)',
                          padding: '0.65rem 1rem',
                          borderRadius: '6px',
                          cursor: currentPage === Math.ceil(filteredTodos.length / itemsPerPage) ? 'not-allowed' : 'pointer',
                          fontSize: '0.85rem'
                        }}
                      >
                        Next
                      </button>
                    </div>
                    <span style={{textAlign: 'center', padding: '0.5rem', color: '#e8eaed', fontSize: '0.9rem'}}>
                      Page {currentPage} of {Math.ceil(filteredTodos.length / itemsPerPage)}
                    </span>
                  </div>
                )}
                </>
              )}
            </div>
          </>
        )}
        </div>
      </div>
    </div>
    </>
  );
}

export default TodoList;
