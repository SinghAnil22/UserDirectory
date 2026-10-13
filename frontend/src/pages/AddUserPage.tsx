import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { createUser } from '../api/usersApi';
import { UserForm } from '../components/UserForm';
import { useToast } from '../toast/ToastContext';
import type { NewUser } from '../types/user';

export function AddUserPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleSubmit = async (user: NewUser) => {
    const created = await createUser(user, auth.token);
    showToast(`User "${created.name}" was added successfully.`);
    navigate('/users');
  };

  return (
    <section>
      <div className="page-header">
        <h1>Add user</h1>
      </div>
      <UserForm submitLabel="Save user" onSubmit={handleSubmit} />
    </section>
  );
}
