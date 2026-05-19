import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard, Users, Shield, Mail,
  Activity, Search, Upload, Download,
  CheckCircle, Clock, Lock, LogOut, User,
  FileText, Trash2, AlertCircle, ChevronRight, X,
  GitBranch, TrendingUp, FileBarChart, Calendar, Plus
} from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, PieChart, Pie } from 'recharts';
import axios from 'axios';

// --- INTERFACCE TYPESCRIPT ---
interface Candidate {
  id: number;
  name: string | null;
  email: string;
  phone: string | null;
  skills: string[];
  status: string;
  created_at: string;
}

interface DashboardStats {
  total_candidates: number;
  skills_bar: { name: string; count: number }[];
  status_pie: { name: string; value: number }[];
  status_distribution: Record<string, number>;
}

const API_BASE = "http://localhost:8000";

const App: React.FC = () => {
  // --- STATO ---
  const [token, setToken] = useState<string | null>(localStorage.getItem('flux_token'));
  const [view, setView] = useState('stats');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState(false);

  const [requiredSkills] = useState([
    { name: 'Python', target: 8 },
    { name: 'React', target: 6 },
    { name: 'TypeScript', target: 5 },
    { name: 'AWS', target: 4 },
    { name: 'Leadership', target: 3 },
  ]);

  // --- CONFIGURAZIONE API ---
  const api = useMemo(() => axios.create({
    baseURL: API_BASE,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  }), [token]);

  // --- FUNZIONI DI GESTIONE ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(false);
    try {
      const params = new URLSearchParams();
      params.append('username', loginData.username);
      params.append('password', loginData.password);
      const res = await axios.post(`${API_BASE}/token`, params);
      const newToken = res.data.access_token;
      localStorage.setItem('flux_token', newToken);
      setToken(newToken);
    } catch (err) {
      setLoginError(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('flux_token');
    setToken(null);
  };

  const fetchData = async () => {
    if (!token) return;
    try {
      const [candRes, statsRes] = await Promise.all([
        api.get('/candidates'),
        api.get('/stats')
      ]);
      setCandidates(candRes.data);
      setStats(statsRes.data);
    } catch (err: any) {
      if (err.response?.status === 401) handleLogout();
    }
  };

  const updateStatus = async (id: number, newStatus: string) => {
    try {
      await api.patch(`/candidates/${id}/status`, { status: newStatus });
      fetchData();
    } catch (err) {
      alert("Errore nell'aggiornamento dello stato.");
    }
  };

  const deleteCandidate = async (id: number) => {
    if (!window.confirm("Eliminare definitivamente il candidato e tutti i suoi dati (GDPR)?")) return;
    try {
      await api.delete(`/candidates/${id}`);
      fetchData();
    } catch (err) {
      alert("Errore durante l'eliminazione.");
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [token, api]);

  // --- LOGICA FILTRI PER LISTA CANDIDATI ---
  const availableSkills = useMemo(() => {
    const skillSet = new Set<string>();
    candidates.forEach(c => {
      c.skills?.forEach(skill => skillSet.add(skill));
    });
    return Array.from(skillSet).sort();
  }, [candidates]);

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedSkills([]);
  };

  const filteredCandidates = candidates.filter(c => {
    const matchesText = searchTerm === "" ||
      (c.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.skills?.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchesText) return false;
    if (selectedSkills.length === 0) return true;
    return c.skills?.some(skill => selectedSkills.includes(skill));
  });

  // --- RENDER: LOGIN ---
  if (!token) {
    return (
      <div className="h-screen w-full bg-[#09090b] flex items-center justify-center p-4 font-sans antialiased">
        <div className="w-full max-w-md bg-[#18181b] border border-[#27272a] rounded-3xl p-10 shadow-2xl relative">
          <div className="text-center mb-8">
            <div className="h-14 w-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20 mx-auto mb-4 text-white">
              <Shield size={28} />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">FluxHR Access</h1>
            <p className="text-[#a1a1aa] mt-2">Protocollo Sicurezza Talent v3.0</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={14} /> Credenziali non valide (admin/password).
              </div>
            )}
            <input
              type="text" placeholder="Username"
              className="w-full bg-[#09090b] border border-[#27272a] p-4 rounded-xl text-white outline-none focus:border-indigo-500 transition-all"
              onChange={e => setLoginData({ ...loginData, username: e.target.value })}
            />
            <input
              type="password" placeholder="Password"
              className="w-full bg-[#09090b] border border-[#27272a] p-4 rounded-xl text-white outline-none focus:border-indigo-500 transition-all"
              onChange={e => setLoginData({ ...loginData, password: e.target.value })}
            />
            <button className="w-full bg-indigo-600 hover:bg-indigo-500 p-4 rounded-xl text-white font-bold shadow-lg shadow-indigo-600/20 transition-all">
              Accedi al Database
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- RENDER: DASHBOARD PRINCIPALE ---
  return (
    <div className="flex h-screen bg-[#09090b] text-[#fafafa] font-sans overflow-hidden antialiased">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#27272a] bg-[#18181b] p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3 px-2 mb-8">
          <div className="h-9 w-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
            <Activity size={20} />
          </div>
          <span className="text-xl font-bold tracking-tight">FluxHR</span>
        </div>
        <nav className="flex flex-col gap-2">
          {[
            { id: 'stats', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
            { id: 'candidates', label: 'Candidati', icon: <Users size={18} /> },
            { id: 'pipeline', label: 'Pipeline', icon: <GitBranch size={18} /> },
            { id: 'skillgap', label: 'Skill Gap', icon: <TrendingUp size={18} /> },
            { id: 'reports', label: 'Report', icon: <FileBarChart size={18} /> },
            { id: 'calendar', label: 'Colloqui', icon: <Calendar size={18} /> },
            { id: 'gdpr', label: 'Compliance', icon: <Shield size={18} /> },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === item.id ? 'bg-indigo-600/10 text-indigo-500 border border-indigo-500/20' : 'text-[#a1a1aa] hover:bg-white/5'}`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
        <button onClick={handleLogout} className="mt-auto p-4 text-red-400 hover:bg-red-500/10 rounded-xl flex items-center gap-3 transition-all">
          <LogOut size={18} /> Logout
        </button>
      </aside>

      <main className="flex-1 p-10 overflow-y-auto">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold tracking-tight capitalize">{view}</h1>
            <p className="text-[#a1a1aa] mt-1">Gestione Talenti Enterprise</p>
          </div>
          {view === 'candidates' && (
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a]" size={16} />
              <input
                type="text" placeholder="Nome, email o skill (es. Python)..."
                className="w-full bg-[#18181b] border border-[#27272a] py-2 pl-10 pr-4 rounded-xl text-sm outline-none focus:border-indigo-500"
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          )}
        </header>

        {/* ========= VIEW 1: DASHBOARD STATS ========= */}
        {view === 'stats' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 bg-[#18181b] p-8 rounded-3xl border border-[#27272a]">
                <h3 className="text-[#a1a1aa] mb-8 uppercase text-[10px] font-bold tracking-widest">Skill Distribution (Real-time)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.skills_bar}>
                      <XAxis dataKey="name" stroke="#525252" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: '#27272a' }} contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '12px' }} />
                      <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={35} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-indigo-600 p-8 rounded-3xl shadow-xl flex flex-col justify-center relative overflow-hidden group">
                <Users className="absolute -right-10 -bottom-10 w-48 h-48 opacity-10 group-hover:scale-110 transition-transform duration-700" />
                <span className="text-indigo-100 uppercase text-[10px] font-bold relative z-10 tracking-widest">Talenti Acquisiti</span>
                <div className="text-7xl font-black mt-2 relative z-10">{stats.total_candidates}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-[#18181b] p-6 rounded-3xl border border-[#27272a]">
                <h3 className="text-[#a1a1aa] mb-4 uppercase text-[10px] font-bold">Stati Candidati</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={stats.status_pie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} fill="#6366f1" label />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-[#18181b] p-6 rounded-3xl border border-[#27272a] flex flex-col justify-center">
                <h3 className="text-[#a1a1aa] mb-4 uppercase text-[10px] font-bold">Trend Assunzioni (settimanale)</h3>
                <div className="text-3xl font-bold text-white">+32%</div>
                <p className="text-xs text-[#71717a] mt-2">rispetto alla scorsa settimana</p>
              </div>
            </div>
          </div>
        )}

        {/* ========= VIEW 2: LISTA CANDIDATI (con checkbox skill) ========= */}
        {view === 'candidates' && (
          <div className="space-y-6">
            {availableSkills.length > 0 && (
              <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity size={16} className="text-indigo-400" />
                    <span className="text-sm font-medium text-white">Filtra per competenze</span>
                    {selectedSkills.length > 0 && (
                      <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {selectedSkills.length} selezionate
                      </span>
                    )}
                  </div>
                  <button onClick={resetFilters} className="text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa] hover:text-white flex items-center gap-1 transition-colors">
                    <X size={12} /> Reset filtri
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableSkills.map(skill => (
                    <label key={skill} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all ${selectedSkills.includes(skill) ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40' : 'bg-[#09090b] text-[#a1a1aa] border border-[#27272a] hover:border-indigo-500/30'}`}>
                      <input type="checkbox" className="w-3.5 h-3.5 rounded border-[#27272a] bg-[#09090b] text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 focus:ring-offset-transparent focus:ring-1" checked={selectedSkills.includes(skill)} onChange={() => toggleSkill(skill)} />
                      {skill}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-[#18181b] rounded-3xl border border-[#27272a] overflow-hidden shadow-2xl">
              <table className="w-full text-left">
                <thead className="bg-[#27272a]/50 text-[#a1a1aa] text-[10px] uppercase tracking-widest font-bold">
                  <tr>
                    <th className="p-6">Nominativo</th>
                    <th className="p-6">Stato Pipeline</th>
                    <th className="p-6">Azioni</th>
                    <th className="p-6 text-right">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272a]">
                  {filteredCandidates.map(c => (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-6">
                        <div className="font-bold text-white">{c.name || 'In attesa di parsing...'}</div>
                        <div className="text-xs text-[#71717a]">{c.email}</div>
                        {c.skills && c.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {c.skills.slice(0, 3).map(skill => (
                              <span key={skill} className="text-[8px] font-mono bg-[#27272a] px-1.5 py-0.5 rounded-full text-[#a1a1aa]">{skill}</span>
                            ))}
                            {c.skills.length > 3 && <span className="text-[8px] text-[#71717a]">+{c.skills.length - 3}</span>}
                          </div>
                        )}
                      </td>
                      <td className="p-6">
                        <select value={c.status} onChange={(e) => updateStatus(c.id, e.target.value)} className={`text-[10px] font-bold uppercase py-1.5 px-3 rounded-full border bg-transparent outline-none cursor-pointer transition-all ${c.status === 'new' ? 'border-blue-500/40 text-blue-400' : c.status === 'reviewed' ? 'border-yellow-500/40 text-yellow-400' : c.status === 'shortlisted' ? 'border-emerald-500/40 text-emerald-400' : 'border-red-500/40 text-red-400'}`}>
                          <option value="new" className="bg-[#18181b]">Nuovo</option>
                          <option value="reviewed" className="bg-[#18181b]">Revisionato</option>
                          <option value="shortlisted" className="bg-[#18181b]">Selezionato</option>
                          <option value="rejected" className="bg-[#18181b]">Scartato</option>
                        </select>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={async () => {
                            try {
                              const res = await api.get(`/candidates/${c.id}/download`, { responseType: 'blob' });
                              const url = URL.createObjectURL(res.data);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `CV_${c.name || c.id}.pdf`;
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              URL.revokeObjectURL(url);
                            } catch { alert('Errore nel download del CV.'); }
                          }} className="p-2 hover:bg-indigo-500/20 rounded-lg text-indigo-400 transition-colors" title="Scarica CV">
                            <Download size={16} />
                          </button>
                          <button onClick={() => deleteCandidate(c.id)} className="p-2 hover:bg-red-500/20 rounded-lg text-red-500 transition-colors" title="Elimina (GDPR)">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                      <td className="p-6 text-right text-xs font-mono text-[#71717a]">{new Date(c.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredCandidates.length === 0 && (
                <div className="p-20 text-center text-[#71717a]">Nessun candidato corrisponde ai filtri selezionati.</div>
              )}
            </div>
          </div>
        )}

        {/* ========= VIEW 3: PIPELINE KANBAN ========= */}
        {view === 'pipeline' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {['new', 'reviewed', 'shortlisted', 'rejected'].map(status => {
              const candidatesByStatus = candidates.filter(c => c.status === status);
              return (
                <div key={status} className="bg-[#18181b] rounded-2xl border border-[#27272a] p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold uppercase text-xs tracking-wider text-[#a1a1aa]">
                      {status === 'new' && '📥 Nuovi'}
                      {status === 'reviewed' && '🔍 Revisionati'}
                      {status === 'shortlisted' && '⭐ Selezionati'}
                      {status === 'rejected' && '❌ Scartati'}
                    </h3>
                    <span className="bg-[#27272a] text-white px-2 py-0.5 rounded-full text-xs">{candidatesByStatus.length}</span>
                  </div>
                  <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                    {candidatesByStatus.map(c => (
                      <div key={c.id} className="bg-[#09090b] p-3 rounded-xl text-sm group">
                        <div className="font-medium text-white">{c.name || 'Anonimo'}</div>
                        <div className="text-[10px] text-[#71717a] truncate">{c.email}</div>
                        <div className="flex justify-between items-center mt-2 opacity-0 group-hover:opacity-100 transition">
                          <button onClick={() => updateStatus(c.id, status === 'new' ? 'reviewed' : status === 'reviewed' ? 'shortlisted' : status === 'shortlisted' ? 'rejected' : 'new')} className="text-[9px] text-indigo-400 hover:text-indigo-300">Avanza stato →</button>
                        </div>
                      </div>
                    ))}
                    {candidatesByStatus.length === 0 && <div className="text-center text-[#71717a] text-xs py-4">Nessun candidato</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ========= VIEW 4: SKILL GAP ANALYSIS ========= */}
        {view === 'skillgap' && (
          <div className="bg-[#18181b] rounded-3xl border border-[#27272a] p-8">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="text-indigo-400" size={24} />Skill Gap Analysis</h2>
                <p className="text-[#a1a1aa] text-sm mt-1">Confronto tra competenze possedute dai candidati e obiettivi di recruiting</p>
              </div>
              <button className="text-indigo-400 text-xs bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">Modifica skill richieste</button>
            </div>
            <div className="space-y-5">
              {requiredSkills.map(skill => {
                const actual = candidates.filter(c => c.skills?.includes(skill.name)).length;
                const target = skill.target;
                const percentage = Math.min(100, (actual / target) * 100);
                const gap = target - actual;
                return (
                  <div key={skill.name}>
                    <div className="flex justify-between text-sm mb-1"><span className="font-medium">{skill.name}</span><span className="text-[#a1a1aa]">{actual} / {target}</span></div>
                    <div className="h-2 bg-[#27272a] rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} /></div>
                    {gap > 0 && <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1"><AlertCircle size={10} /> Mancano {gap} candidato{gap !== 1 && 'i'} con questa skill</p>}
                  </div>
                );
              })}
            </div>
            <div className="mt-10 pt-6 border-t border-[#27272a]">
              <h3 className="text-sm font-semibold mb-2">📌 Skill più richieste dal mercato (esempio)</h3>
              <div className="flex flex-wrap gap-2">{requiredSkills.map(s => <span key={s.name} className="text-xs bg-indigo-500/10 text-indigo-300 px-2 py-1 rounded-full">{s.name}</span>)}</div>
            </div>
          </div>
        )}

        {/* ========= VIEW 5: REPORT ========= */}
        {view === 'reports' && (
          <div className="bg-[#18181b] rounded-3xl border border-[#27272a] p-8">
            <h2 className="text-2xl font-bold mb-2">Esporta Report</h2>
            <p className="text-[#a1a1aa] text-sm mb-8">Scarica i dati dei candidati in formato CSV o stampa la dashboard</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button onClick={() => {
                const headers = ['ID', 'Nome', 'Email', 'Telefono', 'Status', 'Skill', 'Data inserimento'];
                const rows = candidates.map(c => [c.id, c.name || '', c.email, c.phone || '', c.status, (c.skills || []).join('; '), new Date(c.created_at).toLocaleDateString()]);
                const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
                const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `candidati_${new Date().toISOString().slice(0,19)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }} className="bg-indigo-600/20 hover:bg-indigo-600/30 transition-all p-5 rounded-xl flex items-center justify-center gap-3 text-indigo-300 border border-indigo-500/30">
                <Download size={20} /> Export CSV (UTF-8)
              </button>
              <button onClick={() => window.print()} className="bg-[#27272a] hover:bg-[#3f3f46] transition-all p-5 rounded-xl flex items-center justify-center gap-3 text-white">
                <FileText size={20} /> Stampa Dashboard
              </button>
            </div>
            <div className="mt-10 p-4 bg-[#09090b] rounded-xl border border-[#27272a]">
              <div className="flex justify-between items-center">
                <div><div className="text-xs text-[#a1a1aa] uppercase tracking-wider">Totale candidati</div><div className="text-3xl font-bold text-white">{candidates.length}</div></div>
                <div className="text-right"><div className="text-xs text-[#a1a1aa] uppercase tracking-wider">Ultimo aggiornamento</div><div className="text-sm font-mono text-indigo-400">{new Date().toLocaleString()}</div></div>
              </div>
            </div>
          </div>
        )}

        {/* ========= VIEW 6: COLLOQUI ========= */}
        {view === 'calendar' && (
          <div className="bg-[#18181b] rounded-3xl border border-[#27272a] p-8">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold flex items-center gap-2"><Calendar className="text-indigo-400" size={24} />Prossimi Colloqui</h2>
              <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-xl flex items-center gap-2 transition"><Plus size={16} /> Nuovo colloquio</button>
            </div>
            <div className="space-y-3">
              {candidates.slice(0, 6).map((c, idx) => (
                <div key={c.id} className="flex items-center justify-between p-4 bg-[#09090b] rounded-xl border border-[#27272a] hover:border-indigo-500/40 transition">
                  <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">{c.name?.charAt(0) || '?'}</div><div><div className="font-medium text-white">{c.name || 'Candidato senza nome'}</div><div className="text-xs text-[#71717a]">{c.email}</div></div></div>
                  <div className="text-right"><div className="text-indigo-400 text-xs font-semibold">{idx % 3 === 0 && 'Oggi, 15:30'}{idx % 3 === 1 && 'Domani, 10:00'}{idx % 3 === 2 && '12 Mag, 14:00'}</div><div className="text-[10px] text-[#71717a]">Colloquio tecnico</div></div>
                </div>
              ))}
              {candidates.length === 0 && <div className="text-center text-[#71717a] py-12">Nessun colloquio programmato. Aggiungine uno!</div>}
            </div>
          </div>
        )}

        {/* ========= VIEW 7: GDPR COMPLIANCE ========= */}
        {view === 'gdpr' && (
          <div className="bg-[#18181b] border border-[#27272a] rounded-3xl p-10 shadow-2xl">
            <div className="flex items-center justify-between mb-12">
              <div><h2 className="text-2xl font-bold flex items-center gap-3"><Shield className="text-emerald-500" /> Registro Audit Privacy</h2><p className="text-[#a1a1aa] text-sm mt-1 italic">Conformità ai sensi del Regolamento UE 2016/679</p></div>
              <div className="bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-full border border-emerald-500/20 text-[10px] font-bold uppercase tracking-widest">Sistema Integro</div>
            </div>
            <div className="space-y-4">
              {candidates.map(c => (
                <div key={c.id} className="bg-[#09090b] p-6 rounded-2xl border border-[#27272a] flex justify-between items-center group hover:border-indigo-500/40 transition-all">
                  <div className="flex items-center gap-4"><div className="p-3 bg-[#18181b] rounded-xl text-indigo-400 shadow-inner"><Mail size={20} /></div><div><div className="text-sm font-bold text-white uppercase tracking-tight">Art. 14 Informative Sent</div><div className="text-xs text-[#71717a] font-mono">{c.email}</div></div></div>
                  <div className="flex items-center gap-4"><div className="text-right hidden md:block mr-4"><span className="block text-[10px] text-[#71717a] font-bold uppercase">Retention</span><span className="text-xs text-indigo-400 font-bold">180 giorni</span></div><div className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-4 py-2 rounded-full border border-emerald-500/20 flex items-center gap-2"><CheckCircle size={14} /> Completed</div></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;