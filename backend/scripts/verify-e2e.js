/* eslint-disable no-console */
async function main() {
  const base = 'http://localhost:5000/api';
  const now = Date.now();

  const post = async (url, body, token) => {
    const res = await fetch(base + url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${url} ${res.status} ${JSON.stringify(json)}`);
    return json;
  };

  const get = async (url, token) => {
    const res = await fetch(base + url, {
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${url} ${res.status} ${JSON.stringify(json)}`);
    return json;
  };

  const put = async (url, body, token) => {
    const res = await fetch(base + url, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${url} ${res.status} ${JSON.stringify(json)}`);
    return json;
  };

  console.log('1) Register students');
  const s1 = await post('/auth/register', {
    name: 'Stud One',
    email: `s1_${now}@mail.com`,
    password: 'pass123',
    studentId: `S1_${now}`,
    role: 'student',
  });
  const s2 = await post('/auth/register', {
    name: 'Stud Two',
    email: `s2_${now}@mail.com`,
    password: 'pass123',
    studentId: `S2_${now}`,
    role: 'student',
  });

  console.log('2) Create group with student1');
  const g = await post('/groups', { name: `Group_${now}` }, s1.token);

  console.log('3) Add student2 to group by email');
  await post(`/groups/${g._id}/members`, { email: s2.user.email }, s1.token);

  const myGroup = await get('/groups/my', s2.token);
  if (!myGroup || myGroup._id !== g._id) throw new Error('student2 cannot see same group');

  console.log('4) Register admin');
  const admin = await post('/auth/register', {
    name: 'Prof',
    email: `admin_${now}@mail.com`,
    password: 'pass123',
    role: 'admin',
  });

  console.log('5) Admin sees groups');
  const groups = await get('/groups', admin.token);
  if (!Array.isArray(groups) || groups.length === 0) throw new Error('admin groups empty');
  if (!groups.some((x) => x._id === g._id)) throw new Error('admin does not see created group');

  console.log('6) Create assignment to ALL');
  const aAll = await post(
    '/assignments',
    {
      title: 'All Assignment',
      description: 'All desc',
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      oneDriveLink: 'https://onedrive.live.com/',
      targetType: 'all',
    },
    admin.token,
  );

  console.log('7) Create assignment to SPECIFIC group');
  const aSpec = await post(
    '/assignments',
    {
      title: 'Specific Assignment',
      description: 'Spec desc',
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      oneDriveLink: 'https://onedrive.live.com/',
      targetType: 'specific',
      targetGroups: [g._id],
    },
    admin.token,
  );

  console.log('8) Student lists assignments (should include both)');
  const s1As = await get('/assignments', s1.token);
  const ids = s1As.map((x) => x._id);
  if (!ids.includes(aAll._id) || !ids.includes(aSpec._id)) throw new Error('student missing assignments');

  console.log('9) Student confirms submission for SPECIFIC');
  await post(`/submissions/confirm/${aSpec._id}`, {}, s1.token);

  console.log('10) Admin sees submissions overview');
  const subs = await get('/submissions/admin-overview', admin.token);
  if (!Array.isArray(subs) || subs.length === 0) throw new Error('admin submissions empty');
  const found = subs.find((x) => x.assignment && x.assignment._id === aSpec._id && x.group && x.group._id === g._id);
  if (!found) throw new Error('admin cannot see submission for specific assignment');

  console.log('11) Admin analytics summary');
  const summary = await get('/analytics/admin-summary', admin.token);
  if (!summary.counts || typeof summary.counts.groups !== 'number') throw new Error('analytics missing counts');
  const perf = (summary.assignmentPerformance || []).find((p) => String(p.assignmentId) === String(aSpec._id));
  if (!perf) throw new Error('analytics missing assignment performance row');

  console.log('12) Admin edits assignment');
  await put(
    `/assignments/${aAll._id}`,
    {
      title: 'All Assignment (edited)',
      description: 'All desc',
      dueDate: new Date(Date.now() + 172800000).toISOString(),
      oneDriveLink: 'https://onedrive.live.com/',
      targetType: 'all',
      targetGroups: [],
    },
    admin.token,
  );

  console.log('✅ Full feature/API verification passed');
}

main().catch((e) => {
  console.error('❌ Verification failed:', e.message);
  process.exit(1);
});

