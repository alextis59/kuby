// Toast notification component
const React = window.React;

function ToastNotification({ toasts, removeToast }) {
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <div className="toast-content">{toast.message}</div>
          <button 
            className="toast-close" 
            onClick={() => removeToast(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// Toast management hook
function useToasts() {
  const [toasts, setToasts] = React.useState([]);
  
  const showToast = (message, type) => {
    const id = Date.now(); // unique id for this toast
    const newToast = { id, message, type };
    setToasts(prev => [...prev, newToast]);
    
    // Auto-remove toast after 3 seconds
    setTimeout(() => {
      removeToast(id);
    }, 3000);
    
    return id;
  };
  
  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };
  
  return { toasts, showToast, removeToast };
}

// Export to window
window.ToastNotification = ToastNotification;
window.useToasts = useToasts;