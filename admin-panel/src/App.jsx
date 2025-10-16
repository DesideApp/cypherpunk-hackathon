import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import TrafficControl from './pages/TrafficControl';
import UserManagement from './pages/UserManagement';
import Layout from './components/Layout';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<AdminDashboard />} />
          <Route path="/traffic" element={<TrafficControl />} />
          <Route path="/users" element={<UserManagement />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;