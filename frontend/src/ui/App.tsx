import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';

const API = axios.create({ baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` });

type Role = 'student' | 'admin';
type User = { id: string; name: string; email: string; role: Role; studentId?: string };
type Assignment = {
  _id: string;
  title: string;
  description: string;
  dueDate: string;
  oneDriveLink: string;
  targetType: 'all' | 'specific';
  targetGroups: { _id: string; name: string }[];
};
type Group = { _id: string; name: string; members: { _id: string; name: string; email: string; studentId?: string }[] };
type Submission = {
  _id: string;
  assignment: { _id: string; title: string };
  group: { _id: string; name: string };
  confirmedBy: { _id: string; name: string; email: string };
  confirmedAt: string;
};

const tokenKey = 'joineazy_token';
const userKey = 'joineazy_user';

function authHeaders(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export function App() {
  const [token, setToken] = useState<string>(localStorage.getItem(tokenKey) || '');
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem(userKey);
    return raw ? (JSON.parse(raw) as User) : null;
  });
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', studentId: '', role: 'student' as Role });
  const [message, setMessage] = useState('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [group, setGroup] = useState<Group | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [groupName, setGroupName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStudentId, setInviteStudentId] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState<string | null>(null);
  const [assignmentForm, setAssignmentForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    oneDriveLink: '',
    targetType: 'all' as 'all' | 'specific',
    targetGroups: [] as string[],
  });
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);

  const isStudent = user?.role === 'student';
  const isAdmin = user?.role === 'admin';

  async function loadData(currentToken = token, currentUser = user) {
    if (!currentToken || !currentUser) return;
    try {
      const req = authHeaders(currentToken);
      const [aRes] = await Promise.all([API.get('/assignments', req)]);
      setAssignments(aRes.data);

      if (currentUser.role === 'student') {
        const [gRes, sRes] = await Promise.all([API.get('/groups/my', req), API.get('/submissions/my-group', req)]);
        setGroup(gRes.data);
        setSubmissions(sRes.data);
      }

      if (currentUser.role === 'admin') {
        const [allGroupsRes, allSubsRes, analyticsRes] = await Promise.all([
          API.get('/groups', req),
          API.get('/submissions/admin-overview', req),
          API.get('/analytics/admin-summary', req),
        ]);
        setGroups(allGroupsRes.data);
        setSubmissions(allSubsRes.data);
        setAnalytics(analyticsRes.data);
      }
    } catch (error: any) {
      setMessage(error.response?.data?.message || 'Failed to load data');
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const submissionMap = useMemo(() => {
    const map = new Map<string, Submission>();
    submissions.forEach((s) => {
      if ((group && s.group?._id === group._id) || isAdmin) map.set(s.assignment._id || s.assignment?.toString(), s);
    });
    return map;
  }, [submissions, group, isAdmin]);

  async function handleAuth() {
    try {
      setMessage('');
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const payload =
        mode === 'login'
          ? { email: form.email, password: form.password }
          : {
              name: form.name,
              email: form.email,
              password: form.password,
              studentId: form.studentId || undefined,
              role: form.role,
            };
      const res = await API.post(endpoint, payload);
      localStorage.setItem(tokenKey, res.data.token);
      localStorage.setItem(userKey, JSON.stringify(res.data.user));
      setToken(res.data.token);
      setUser(res.data.user);
      await loadData(res.data.token, res.data.user);
    } catch (error: any) {
      setMessage(error.response?.data?.message || 'Authentication failed');
    }
  }

  async function createGroup() {
    try {
      const res = await API.post('/groups', { name: groupName }, authHeaders(token));
      setGroup(res.data);
      setGroupName('');
      setMessage('Group created');
    } catch (error: any) {
      setMessage(error.response?.data?.message || 'Could not create group');
    }
  }

  async function addMember() {
    if (!group) return;
    try {
      const res = await API.post(
        `/groups/${group._id}/members`,
        { email: inviteEmail || undefined, studentId: inviteStudentId || undefined },
        authHeaders(token),
      );
      setGroup(res.data);
      setInviteEmail('');
      setInviteStudentId('');
      setMessage('Member added');
    } catch (error: any) {
      setMessage(error.response?.data?.message || 'Could not add member');
    }
  }

  async function confirmSubmission(assignmentId: string) {
    try {
      await API.post(`/submissions/confirm/${assignmentId}`, {}, authHeaders(token));
      setConfirmStep(null);
      await loadData();
      setMessage('Submission confirmed');
    } catch (error: any) {
      setMessage(error.response?.data?.message || 'Could not confirm submission');
    } finally {
      setConfirmingId(null);
    }
  }

  async function saveAssignment() {
    try {
      if (editingAssignmentId) {
        await API.put(`/assignments/${editingAssignmentId}`, assignmentForm, authHeaders(token));
      } else {
        await API.post('/assignments', assignmentForm, authHeaders(token));
      }
      setAssignmentForm({
        title: '',
        description: '',
        dueDate: '',
        oneDriveLink: '',
        targetType: 'all',
        targetGroups: [],
      });
      setEditingAssignmentId(null);
      await loadData();
      setMessage('Assignment saved');
    } catch (error: any) {
      setMessage(error.response?.data?.message || 'Could not save assignment');
    }
  }

  function editAssignment(a: Assignment) {
    setEditingAssignmentId(a._id);
    setAssignmentForm({
      title: a.title,
      description: a.description,
      dueDate: a.dueDate.slice(0, 10),
      oneDriveLink: a.oneDriveLink,
      targetType: a.targetType,
      targetGroups: a.targetGroups?.map((g) => g._id) || [],
    });
  }

  function logout() {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    setToken('');
    setUser(null);
    setAssignments([]);
    setGroup(null);
    setGroups([]);
    setSubmissions([]);
    setAnalytics(null);
  }

  const progressPercent = useMemo(() => {
    if (!isStudent || assignments.length === 0) return 0;
    const done = assignments.filter((a) => submissionMap.has(a._id)).length;
    return Math.round((done / assignments.length) * 100);
  }, [isStudent, assignments, submissionMap]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Joineazy - Group Assignment System</h1>
            <p className="text-sm text-slate-400">MERN + JWT roles (Student/Admin)</p>
          </div>
          {user && (
            <div className="flex items-center gap-3 text-sm">
              <span className="rounded bg-slate-800 px-2 py-1">
                {user.name} ({user.role})
              </span>
              <button className="rounded bg-rose-600 px-3 py-1.5" onClick={logout}>
                Logout
              </button>
            </div>
          )}
        </header>

        {message && <div className="mb-4 rounded border border-slate-700 bg-slate-900 p-3 text-sm">{message}</div>}

        {!user ? (
          <section className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-5 sm:max-w-md">
            <div className="flex gap-2">
              <button className="rounded bg-slate-700 px-3 py-1.5 text-sm" onClick={() => setMode('login')}>
                Login
              </button>
              <button className="rounded bg-slate-700 px-3 py-1.5 text-sm" onClick={() => setMode('register')}>
                Register
              </button>
            </div>
            {mode === 'register' && (
              <>
                <input
                  className="rounded bg-slate-800 p-2 text-sm"
                  placeholder="Name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <input
                  className="rounded bg-slate-800 p-2 text-sm"
                  placeholder="Student ID (optional)"
                  value={form.studentId}
                  onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                />
                <select
                  className="rounded bg-slate-800 p-2 text-sm"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                >
                  <option value="student">Student</option>
                  <option value="admin">Admin</option>
                </select>
              </>
            )}
            <input
              className="rounded bg-slate-800 p-2 text-sm"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              className="rounded bg-slate-800 p-2 text-sm"
              placeholder="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button className="rounded bg-indigo-600 px-3 py-2 text-sm" onClick={handleAuth}>
              {mode === 'login' ? 'Login' : 'Register'}
            </button>
          </section>
        ) : (
          <main className="grid gap-5">
            {isStudent && (
              <>
                <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <h2 className="mb-2 font-semibold">My Group</h2>
                  {!group ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className="rounded bg-slate-800 p-2 text-sm"
                        placeholder="Group name"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                      />
                      <button className="rounded bg-indigo-600 px-3 py-2 text-sm" onClick={createGroup}>
                        Create Group
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      <div>
                        <div className="text-sm text-slate-400">Group</div>
                        <div className="font-medium">{group.name}</div>
                      </div>
                      <div>
                        <div className="mb-1 text-sm text-slate-400">Members</div>
                        <div className="grid gap-1 text-sm">
                          {group.members.map((m) => (
                            <div key={m._id} className="rounded bg-slate-800 p-2">
                              {m.name} - {m.email} {m.studentId ? `(${m.studentId})` : ''}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <input
                          className="rounded bg-slate-800 p-2 text-sm"
                          placeholder="Invite by email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                        />
                        <input
                          className="rounded bg-slate-800 p-2 text-sm"
                          placeholder="or student ID"
                          value={inviteStudentId}
                          onChange={(e) => setInviteStudentId(e.target.value)}
                        />
                        <button className="rounded bg-indigo-600 px-3 py-2 text-sm" onClick={addMember}>
                          Add Member
                        </button>
                      </div>
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <h2 className="mb-3 font-semibold">Assignment Progress</h2>
                  <div className="mb-2 h-3 w-full rounded bg-slate-800">
                    <div className="h-3 rounded bg-emerald-500" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <div className="text-sm text-slate-400">{progressPercent}% completed</div>
                </section>
              </>
            )}

            {isAdmin && (
              <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <h2 className="mb-3 font-semibold">{editingAssignmentId ? 'Edit Assignment' : 'Create Assignment'}</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="rounded bg-slate-800 p-2 text-sm"
                    placeholder="Title"
                    value={assignmentForm.title}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                  />
                  <input
                    className="rounded bg-slate-800 p-2 text-sm"
                    type="date"
                    value={assignmentForm.dueDate}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })}
                  />
                  <input
                    className="rounded bg-slate-800 p-2 text-sm sm:col-span-2"
                    placeholder="Description"
                    value={assignmentForm.description}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                  />
                  <input
                    className="rounded bg-slate-800 p-2 text-sm sm:col-span-2"
                    placeholder="OneDrive Link"
                    value={assignmentForm.oneDriveLink}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, oneDriveLink: e.target.value })}
                  />
                  <select
                    className="rounded bg-slate-800 p-2 text-sm"
                    value={assignmentForm.targetType}
                    onChange={(e) =>
                      setAssignmentForm({
                        ...assignmentForm,
                        targetType: e.target.value as 'all' | 'specific',
                        targetGroups: e.target.value === 'all' ? [] : assignmentForm.targetGroups,
                      })
                    }
                  >
                    <option value="all">Assign to all groups</option>
                    <option value="specific">Assign to specific groups</option>
                  </select>
                  {assignmentForm.targetType === 'specific' && (
                    <select
                      multiple
                      className="rounded bg-slate-800 p-2 text-sm"
                      value={assignmentForm.targetGroups}
                      onChange={(e) =>
                        setAssignmentForm({
                          ...assignmentForm,
                          targetGroups: Array.from(e.target.selectedOptions).map((opt) => opt.value),
                        })
                      }
                    >
                      {groups.map((g) => (
                        <option key={g._id} value={g._id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <button className="rounded bg-indigo-600 px-3 py-2 text-sm" onClick={saveAssignment}>
                    {editingAssignmentId ? 'Update Assignment' : 'Create Assignment'}
                  </button>
                  {editingAssignmentId && (
                    <button
                      className="rounded bg-slate-700 px-3 py-2 text-sm"
                      onClick={() => {
                        setEditingAssignmentId(null);
                        setAssignmentForm({
                          title: '',
                          description: '',
                          dueDate: '',
                          oneDriveLink: '',
                          targetType: 'all',
                          targetGroups: [],
                        });
                      }}
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </section>
            )}

            <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <h2 className="mb-3 font-semibold">Assignments</h2>
              <div className="grid gap-3">
                {assignments.map((a) => {
                  const done = submissionMap.has(a._id);
                  return (
                    <div key={a._id} className="rounded-lg border border-slate-700 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-medium">{a.title}</h3>
                        <span className="text-xs text-slate-400">Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-300">{a.description}</p>
                      <a
                        href={a.oneDriveLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-sm text-indigo-300 underline"
                      >
                        Open OneDrive submission link
                      </a>
                      <div className="mt-2 text-xs text-slate-400">
                        Target: {a.targetType === 'all' ? 'All groups' : a.targetGroups.map((g) => g.name).join(', ')}
                      </div>

                      {isStudent && (
                        <div className="mt-3">
                          {done ? (
                            <span className="rounded bg-emerald-700 px-2 py-1 text-xs">Confirmed</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                className="rounded bg-amber-600 px-3 py-1.5 text-xs"
                                onClick={() => {
                                  setConfirmingId(a._id);
                                  setConfirmStep(a._id);
                                }}
                              >
                                Yes, I have submitted
                              </button>
                              {confirmStep === a._id && confirmingId === a._id && (
                                <button
                                  className="rounded bg-emerald-600 px-3 py-1.5 text-xs"
                                  onClick={() => confirmSubmission(a._id)}
                                >
                                  Confirm now
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {isAdmin && (
                        <button className="mt-2 rounded bg-slate-700 px-3 py-1.5 text-xs" onClick={() => editAssignment(a)}>
                          Edit
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {isAdmin && analytics && (
              <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <h2 className="mb-3 font-semibold">Admin Analytics</h2>
                <div className="mb-3 grid gap-2 sm:grid-cols-4">
                  <StatCard label="Groups" value={analytics.counts.groups} />
                  <StatCard label="Assignments" value={analytics.counts.assignments} />
                  <StatCard label="Confirmations" value={analytics.counts.confirmations} />
                  <StatCard label="Overall Completion" value={`${analytics.counts.overallCompletionRate}%`} />
                </div>
                <div className="grid gap-2">
                  {analytics.assignmentPerformance.map((p: any) => (
                    <div key={p.assignmentId} className="rounded bg-slate-800 p-3">
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span>{p.title}</span>
                        <span>{p.confirmedGroups + '/' + p.expectedGroups}</span>
                      </div>
                      <div className="h-2 rounded bg-slate-700">
                        <div className="h-2 rounded bg-cyan-500" style={{ width: `${p.completionRate}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {isAdmin && (
              <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <h2 className="mb-3 font-semibold">Submission Confirmations (Group & Student wise)</h2>
                <div className="grid gap-2 text-sm">
                  {submissions.map((s) => (
                    <div key={s._id} className="rounded bg-slate-800 p-3">
                      <div>
                        <strong>{s.assignment?.title}</strong> | Group: {s.group?.name}
                      </div>
                      <div className="text-slate-300">
                        Confirmed by: {s.confirmedBy?.name} ({s.confirmedBy?.email})
                      </div>
                      <div className="text-xs text-slate-400">{new Date(s.confirmedAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </main>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded bg-slate-800 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

