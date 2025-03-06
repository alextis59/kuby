# Kuby

## Overview

This is a local web application designed to retrieve, parse, and search logs from Kubernetes pods. It runs on Ubuntu and features a Node.js/Express back-end and a React front-end. Users can select namespaces and pods, retrieve full logs or the last X lines, sort logs by timestamp, and filter them using search terms or time ranges.

## Features

### Back-End
- Executes \`kubectl\` commands to fetch namespaces, pods, and logs.
- Provides RESTful API endpoints for data retrieval.
- Supports fetching complete logs or the last X lines.
- Fallback mechanism to retrieve namespaces directly when no contexts are found.

### Front-End
- User-friendly interface for selecting namespaces and pods.
- Options to retrieve complete logs or specify the number of lines from the tail.
- Displays logs sorted by timestamp.
- Search functionality to filter logs by a string.
- Time range filter to view logs within a specific period.
- Editable log parsing options stored in \`localStorage\`.

## Prerequisites

- **Ubuntu**: The application is designed to run on Ubuntu.
- **kubectl**: Must be installed and configured to communicate with your Kubernetes cluster.
- **Node.js and npm**: Required for running the back-end and building the front-end.
- **React**: Used for the front-end framework.

## Installation

1. **Clone the Repository**:
   \`\`\`bash
   git clone <repository-url>
   cd kuby
   \`\`\`

2. **Install Back-End Dependencies**:
   \`\`\`bash
   npm install
   \`\`\`

3. **Install Front-End Dependencies**:
   \`\`\`bash
   cd client
   npm install
   cd ..
   \`\`\`

4. **Build the React App**:
   \`\`\`bash
   cd client
   npm run build
   cd ..
   \`\`\`

5. **Start the Server**:
   \`\`\`bash
   node server.js
   \`\`\`

6. **Access the Application**:
   Open your browser and navigate to \`http://localhost:3000\`.

## Usage

1. **Select a Namespace**: Choose a namespace from the dropdown.
2. **Select a Pod**: Choose a pod from the selected namespace.
3. **Choose Log Options**:
   - Select "Complete Logs" to fetch all logs.
   - Select "Last X Lines" and specify the number of lines to fetch from the tail.
4. **Fetch Logs**: Click the "Fetch Logs" button to retrieve the logs.
5. **Search and Filter**:
   - Use the search bar to filter logs by a specific string.
   - Set a time range to filter logs within a specific period.
6. **Edit Parsing Options**:
   - Click "Edit Parsing Options" to open a modal where you can add or edit regex patterns for log parsing.
   - Parsing options are stored in \`localStorage\` and associated with pod names.

## Customization

- **Default Timestamp Regex**: The default regex for timestamp parsing is \`/^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\]/\`. You can customize this for specific pods in the parsing options.
- **Styling**: Basic styling is provided in \`client/src/App.css\`. You can modify this file or add additional CSS to enhance the UI.

## Troubleshooting

- **kubectl Issues**: Ensure that \`kubectl\` is properly installed and configured to access your Kubernetes cluster.
- **No Logs Displayed**: Verify that the selected pod is running and generating logs.
- **Parsing Errors**: If logs are not parsed correctly, adjust the regex pattern in the parsing options editor.

---

## Version History

- **1.1.1**: Added fallback mechanism to retrieve namespaces directly when no contexts are found.
- **1.1.0**: Added support for log parsing options modal and improved streaming.
- **1.0.0**: Initial release with core functionality.

This application provides a powerful tool for managing and analyzing Kubernetes logs with a focus on ease of use and customization.
