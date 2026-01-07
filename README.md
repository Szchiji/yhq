# Lottery Bot Management Dashboard

A Next.js application with App Router and Tailwind CSS for managing lottery bot operations.

## Features

- **Responsive Layout**: Fixed sidebar navigation with collapsible menu items
- **Message Templates**: Rich text editor for customizing lottery message templates with placeholder support
- **Lottery Management**: Comprehensive settings interface with three tabs:
  - **Basic Info**: Configure lottery title, media, description, participation methods, and draw settings
  - **Prize Settings**: Manage prizes with add/remove functionality
  - **Notification Settings**: Customize winner, creator, and group notifications

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Szchiji/yhq.git
cd yhq
```

2. Install dependencies:
```bash
npm install
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

### Build

Create a production build:

```bash
npm run build
```

### Start Production Server

After building, start the production server:

```bash
npm start
```

## Project Structure

```
yhq/
├── app/                      # Next.js App Router pages
│   ├── layout.tsx           # Root layout with sidebar
│   ├── page.tsx             # Home page
│   ├── templates/           # Message templates page
│   ├── settings/            # Lottery management page
│   ├── announcements/       # Placeholder page
│   ├── groups/              # Placeholder page
│   ├── forced-join/         # Placeholder page
│   ├── users/               # Placeholder page
│   └── scheduled/           # Placeholder page
├── components/              # React components
│   └── Sidebar.tsx          # Navigation sidebar
├── public/                  # Static assets
├── tailwind.config.ts       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
└── package.json             # Project dependencies
```

## Technologies Used

- **Next.js 14**: React framework with App Router
- **React 18**: UI library
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **PostCSS**: CSS processing

## Pages

### Message Templates (`/templates`)
- Tab-based interface for different template types
- Rich text editor with formatting toolbar
- Placeholder chips for dynamic content
- Button preview and management

### Lottery Management (`/settings`)
- **Basic Info Tab**: Form inputs for lottery configuration
- **Prize Settings Tab**: Prize list management with modal dialog
- **Notification Settings Tab**: Customizable notification templates

## License

This project is private and proprietary.
