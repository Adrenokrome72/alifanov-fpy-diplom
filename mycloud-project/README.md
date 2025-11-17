# MyCloud - Personal Cloud Storage

A full-stack web application for personal cloud storage with file management, user authentication, and admin panel.

## Features

- **File Management**: Upload, download, rename, move, and delete files and folders
- **User Authentication**: Registration, login, logout with session management
- **Admin Panel**: User management, storage monitoring, and system administration
- **Responsive UI**: Modern React frontend with Tailwind CSS
- **REST API**: Django REST Framework backend
- **Database**: PostgreSQL with proper migrations
- **Docker Support**: Fully containerized deployment

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Git

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd mycloud-project
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start the application:**
   ```bash
   docker-compose -f infra/docker-compose.yml up --build
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - Admin Panel: http://localhost:80/admin/

### Default Credentials

- **Admin User**: admin / admin123 (change in .env)

## Architecture

### Services

- **db**: PostgreSQL database
- **backend**: Django REST API server
- **frontend**: React SPA served by Nginx
- **nginx**: Reverse proxy and static file server

### Key Technologies

- **Backend**: Django, Django REST Framework, PostgreSQL
- **Frontend**: React, Redux Toolkit, Tailwind CSS, Webpack
- **Infrastructure**: Docker, Docker Compose, Nginx

## Development

### Local Development Setup

1. **Backend:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py runserver
   ```

2. **Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Testing

```bash
# Backend tests
cd backend
python manage.py test

# Frontend tests
cd frontend
npm test
```

## Configuration

### Environment Variables

See `.env.example` for all available configuration options.

### Production Deployment

1. Update `.env` with production values
2. Set `DJANGO_DEBUG=False`
3. Configure proper `DJANGO_ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS`
4. Use strong passwords and secret keys
5. Set up SSL certificates for HTTPS

## API Documentation

### Authentication Endpoints

- `POST /api/auth/register/` - User registration
- `POST /api/auth/login/` - User login
- `POST /api/auth/logout/` - User logout
- `GET /api/auth/me/` - Get current user info

### File Management Endpoints

- `GET /api/files/` - List user files
- `POST /api/files/` - Upload file
- `GET /api/files/{id}/` - Get file details
- `PUT /api/files/{id}/` - Update file
- `DELETE /api/files/{id}/` - Delete file

### Folder Management Endpoints

- `GET /api/folders/` - List user folders
- `POST /api/folders/` - Create folder
- `GET /api/folders/{id}/` - Get folder details
- `PUT /api/folders/{id}/` - Update folder
- `DELETE /api/folders/{id}/` - Delete folder
- `GET /api/folders/tree/` - Get folder tree

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
