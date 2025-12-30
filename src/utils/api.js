// API configuration
// Uses Vite environment variable: VITE_API_URL
// Local development: VITE_API_URL=http://localhost:5050
// Production: VITE_API_URL=https://projectbackend-api.onrender.com

export const API = import.meta.env.VITE_API_URL || 'http://localhost:5050';

