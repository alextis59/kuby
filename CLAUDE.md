# Kuby - Kubernetes Log Viewer

## Project Structure
- `/api/` - Backend Express server
  - `server.js` - Main server with kubectl endpoints
  - `mock_server.js` - Testing server without K8s dependency
- `/app/` - Frontend React application
  - `App.js` - Main React component with all UI logic
  - `App.css` - Styling for the application
  - `index.html` - Entry point HTML

## Key Features
- Fetches and displays Kubernetes logs through kubectl commands
- Namespace and pod selection interface
- Log filtering by search terms and time ranges
- Customizable timestamp parsing with regex patterns
- Settings stored in localStorage

## Available Commands
- `npm start` - Start production server
- `npm run dev` - Start development server with hot reloading
- `npm run mock` - Run mock server for testing

## Implementation Notes
- Backend uses Express to execute kubectl commands
- Frontend uses React with hooks for state management
- Time parsing uses moment.js for flexible timestamp formats
- Custom regex patterns can be defined per pod prefix

## Additional instructions

- No need to start the server or mock, it is already running