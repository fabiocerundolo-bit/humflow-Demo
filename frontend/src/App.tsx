import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard, Users, Shield, Mail,
  Activity, Search, Upload, Download,
  CheckCircle, Clock, Lock, LogOut, User,
  FileText, Trash2, AlertCircle, ChevronRight, X,
  GitBranch, TrendingUp, FileBarChart, Calendar, Plus,
  ChevronLeft
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

interface Interview {
  id: number;
  candidateId: number;
  candidateName: string;
  candidateEmail: string;
  date: string;
  time: string;
  type: string;
}

const API_BASE = "http://localhost:8000";

// --- COMPONENTE PAGINAZIONE RIUTILIZZABILE ---
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }) => {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Genera i numeri di pagina da mostrare
  const getPageNumbers = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-between mt-6 px-2">
      <span className="text-xs text-[#71717a] font-mono">
        {startItem}–{endItem} di {totalItems} risultati
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg text-[#a1a1aa] hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft size={16} />
        </button>
        {getPageNumbers().map((page, idx) =>
          page === '...' ? (
            <span key={`dots-${idx}`} className="px-2 text-[#71717a] text-sm">…</span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page as number)}
              className={`w-9 h-9 rounded-xl text-sm font-medium transition-all ${
                currentPage === page
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-[#a1a1aa] hover:bg-white/5'
              }`}
            >
              {page}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg text-[#a1a1aa] hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  // --- STATO PRINCIPALE ---
  const [token, setToken] = useState<string | null>(localStorage.getItem('flux_token'));
  const [view, setView] = useState('stats');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState(false);

  // --- STATO PER SELEZIONE MULTIPLA ED ELIMINAZIONE ---
  const [selectedCandidates, setSelectedCandidates] = useState<Set<number>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- STATO PER DRAG & DROP UPLOAD ---
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<{ name: string; status: 'pending' | 'uploading' | 'success' | 'error' }[]>([]);

  // --- PAGINAZIONE CANDIDATI ---
  const [candidatesPage, setCandidatesPage] = useState(1);
  const CANDIDATES_PER_PAGE = 10;

  // --- PAGINAZIONE COLLOQUI ---
  const [interviewsPage, setInterviewsPage] = useState(1);
  const INTERVIEWS_PER_PAGE = 5;

  // --- STATO COLLOQUI MANUALI ---
  const [manualInterviews, setManualInterviews] = useState<Interview[]>([]);
  const [showNewInterviewModal, setShowNewInterviewModal] = useState(false);
  const [newInterviewForm, setNewInterviewForm] = useState({
    candidateId: '',
    date: '',
    time: '',
    type: 'Colloquio tecnico',
  });
  const [newInterviewError, setNewInterviewError] = useState('');

  // --- FILTRI COLLOQUI ---
  const [interviewSearchTerm, setInterviewSearchTerm] = useState('');
  const [interviewTypeFilter, setInterviewTypeFilter] = useState('');

  // --- CANCELLAZIONE COLLOQUI ---
  const [deletedMockInterviewIds, setDeletedMockInterviewIds] = useState<Set<number>>(new Set());
  const [showDeleteInterviewModal, setShowDeleteInterviewModal] = useState(false);
  const [interviewToDelete, setInterviewToDelete] = useState<Interview | null>(null);

  // --- SKILL RICHIESTE PER GAP ANALYSIS (ESEMPIO) ---
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

  // --- FUNZIONI DI AUTENTICAZIONE E DATI ---
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

  // --- CRUD ---
  const updateStatus = async (id: number, newStatus: string) => {
    try {
      await api.patch(`/candidates/${id}/status`, { status: newStatus });
      fetchData();
    } catch (err) {
      alert("Errore nell'aggiornamento dello stato.");
    }
  };

  const deleteSingleCandidate = async (id: number) => {
    try {
      await api.delete(`/candidates/${id}`);
    } catch (err) {
      throw err;
    }
  };

  const handleDeleteSelected = async () => {
    setIsDeleting(true);
    const ids = Array.from(selectedCandidates);
    try {
      await Promise.all(ids.map(id => deleteSingleCandidate(id)));
      await fetchData();
      setSelectedCandidates(new Set());
      setShowDeleteModal(false);
    } catch (err) {
      alert("Errore durante l'eliminazione di alcuni candidati.");
    } finally {
      setIsDeleting(false);
    }
  };

  // --- SELEZIONE MULTIPLA ---
  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = paginatedCandidates.map(c => c.id);
      setSelectedCandidates(new Set(allIds));
    } else {
      setSelectedCandidates(new Set());
    }
  };

  const toggleSelectOne = (id: number, checked: boolean) => {
    const newSet = new Set(selectedCandidates);
    if (checked) newSet.add(id);
    else newSet.delete(id);
    setSelectedCandidates(newSet);
  };

  // --- UPLOAD CON DRAG & DROP ---
  const uploadCV = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post('/upload-cv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { success: true };
    } catch (err) {
      console.error(`Errore upload ${file.name}:`, err);
      return { success: false };
    }
  };

  const uploadFiles = async (files: File[]) => {
    const validFiles = files.filter(f => f.name.endsWith('.pdf') || f.name.endsWith('.docx'));
    if (validFiles.length === 0) {
      alert('Sono accettati solo file PDF o DOCX');
      return;
    }

    const newUploads = validFiles.map(f => ({ name: f.name, status: 'pending' as const }));
    setUploadingFiles(prev => [...prev, ...newUploads]);

    for (const file of validFiles) {
      setUploadingFiles(prev =>
        prev.map(u => u.name === file.name ? { ...u, status: 'uploading' } : u)
      );
      const result = await uploadCV(file);
      setUploadingFiles(prev =>
        prev.map(u =>
          u.name === file.name ? { ...u, status: result.success ? 'success' : 'error' } : u
        )
      );
    }
    await fetchData();
    setTimeout(() => {
      setUploadingFiles(prev => prev.filter(u => u.status !== 'success' && u.status !== 'error'));
    }, 4000);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    await uploadFiles(files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // --- FILTRI PER SKILL E TESTO ---
  const availableSkills = useMemo(() => {
    const skillSet = new Set<string>();
    candidates.forEach(c => c.skills?.forEach(skill => skillSet.add(skill)));
    return Array.from(skillSet).sort();
  }, [candidates]);

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
    setCandidatesPage(1); // reset pagina al cambio filtro
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedSkills([]);
    setSelectedCandidates(new Set());
    setCandidatesPage(1);
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

  // --- PAGINAZIONE APPLICATA ---
  const totalCandidatePages = Math.ceil(filteredCandidates.length / CANDIDATES_PER_PAGE);
  const paginatedCandidates = filteredCandidates.slice(
    (candidatesPage - 1) * CANDIDATES_PER_PAGE,
    candidatesPage * CANDIDATES_PER_PAGE
  );

  // --- AGGIUNGI NUOVO COLLOQUIO ---
  const handleAddInterview = () => {
    setNewInterviewError('');
    if (!newInterviewForm.candidateId) {
      setNewInterviewError('Seleziona un candidato.');
      return;
    }
    if (!newInterviewForm.date) {
      setNewInterviewError('Inserisci una data.');
      return;
    }
    if (!newInterviewForm.time) {
      setNewInterviewError("Inserisci un'ora.");
      return;
    }
    const candidate = candidates.find(c => c.id === Number(newInterviewForm.candidateId));
    if (!candidate) {
      setNewInterviewError('Candidato non trovato.');
      return;
    }
    const dateObj = new Date(`${newInterviewForm.date}T${newInterviewForm.time}`);
    const formatted = dateObj.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) + ', ' + newInterviewForm.time;
    const newInterview: Interview = {
      id: Date.now(),
      candidateId: candidate.id,
      candidateName: candidate.name || 'Candidato senza nome',
      candidateEmail: candidate.email,
      date: newInterviewForm.date,
      time: formatted,
      type: newInterviewForm.type,
    };
    setManualInterviews(prev => [...prev, newInterview]);
    setShowNewInterviewModal(false);
    setNewInterviewForm({ candidateId: '', date: '', time: '', type: 'Colloquio tecnico' });
    setNewInterviewError('');
  };

  // --- CANCELLA COLLOQUIO ---
  const handleDeleteInterview = () => {
    if (!interviewToDelete) return;
    if (interviewToDelete.id > 0) {
      // colloquio manuale: rimuovilo dall'array
      setManualInterviews(prev => prev.filter(i => i.id !== interviewToDelete.id));
    } else {
      // colloquio mockup: traccia l'id come eliminato
      setDeletedMockInterviewIds(prev => { const next = new Set(Array.from(prev)); next.add(interviewToDelete.id); return next; });
    }
    setShowDeleteInterviewModal(false);
    setInterviewToDelete(null);
  };

  // Dati colloqui (mockup basato sui candidati + colloqui aggiunti manualmente)
  const mockInterviews = candidates.slice(0, Math.min(candidates.length, 20)).map((c, idx) => ({
    id: c.id * -1,
    candidateId: c.id,
    candidateName: c.name || 'Candidato senza nome',
    candidateEmail: c.email,
    date: '',
    time: idx % 3 === 0 ? 'Oggi, 15:30' : idx % 3 === 1 ? 'Domani, 10:00' : '12 Mag, 14:00',
    type: idx % 2 === 0 ? 'Colloquio tecnico' : 'Colloquio HR',
  }));
  const allInterviews = [...manualInterviews, ...mockInterviews.filter(m => !deletedMockInterviewIds.has(m.id))];

  const filteredInterviews = allInterviews.filter(i => {
    const matchesSearch = interviewSearchTerm === '' ||
      i.candidateName.toLowerCase().includes(interviewSearchTerm.toLowerCase()) ||
      i.candidateEmail.toLowerCase().includes(interviewSearchTerm.toLowerCase());
    const matchesType = interviewTypeFilter === '' || i.type === interviewTypeFilter;
    return matchesSearch && matchesType;
  });

  const totalInterviewPages = Math.ceil(filteredInterviews.length / INTERVIEWS_PER_PAGE);
  const paginatedInterviews = filteredInterviews.slice(
    (interviewsPage - 1) * INTERVIEWS_PER_PAGE,
    interviewsPage * INTERVIEWS_PER_PAGE
  );

  const allSelected = paginatedCandidates.length > 0 && paginatedCandidates.every(c => selectedCandidates.has(c.id));
  const someSelected = selectedCandidates.size > 0;

  // Reset pagina quando cambia la ricerca
  useEffect(() => {
    setCandidatesPage(1);
  }, [searchTerm]);

  // Reset pagina colloqui quando cambiano i filtri
  useEffect(() => {
    setInterviewsPage(1);
  }, [interviewSearchTerm, interviewTypeFilter]);

  // --- INIT E POLLING ---
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [token, api]);

  // --- RENDER LOGIN ---
  if (!token) {
    return (
      <div className="h-screen w-full bg-[#09090b] flex items-center justify-center p-4 font-sans antialiased">
        <div className="w-full max-w-md bg-[#18181b] border border-[#27272a] rounded-3xl p-10 shadow-2xl relative">
          <div className="text-center mb-8">
            <div className="h-14 w-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20 mx-auto mb-4 text-white">
              <Shield size={28} />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">humflow Access</h1>
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

  // --- RENDER DASHBOARD PRINCIPALE ---
  return (
    <div className="flex h-screen bg-[#09090b] text-[#fafafa] font-sans overflow-hidden antialiased">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#27272a] bg-[#18181b] p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3 px-2 mb-8">
          <div className="h-9 w-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
            <Activity size={20} />
          </div>
          <span className="text-xl font-bold tracking-tight">humflow</span>
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
            <div className="flex gap-4">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a]" size={16} />
                <input
                  type="text" placeholder="Nome, email o skill (es. Python)..."
                  className="w-full bg-[#18181b] border border-[#27272a] py-2 pl-10 pr-4 rounded-xl text-sm outline-none focus:border-indigo-500"
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              {someSelected && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-xl flex items-center gap-2 transition-all border border-red-500/30"
                >
                  <Trash2 size={16} /> Elimina selezionati ({selectedCandidates.size})
                </button>
              )}
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

        {/* ========= VIEW 2: CANDIDATI con PAGINAZIONE ========= */}
        {view === 'candidates' && (
          <div className="space-y-6">
            {/* Drag & Drop Area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer text-center ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-[#27272a] bg-[#18181b]/50 hover:border-indigo-500/50'
              }`}
            >
              <input
                type="file"
                id="fileInput"
                multiple
                accept=".pdf,.docx"
                className="hidden"
                onChange={async (e) => {
                  if (e.target.files) {
                    const files = Array.from(e.target.files);
                    await uploadFiles(files);
                    e.target.value = '';
                  }
                }}
              />
              <div className="flex flex-col items-center gap-3">
                <Upload size={40} className="text-indigo-400" />
                <div className="text-sm font-medium text-white">Trascina qui i CV (PDF o DOCX)</div>
                <div className="text-xs text-[#71717a]">
                  oppure{' '}
                  <label htmlFor="fileInput" className="text-indigo-400 cursor-pointer hover:underline">
                    seleziona dal computer
                  </label>
                </div>
                <div className="text-[10px] text-[#71717a] mt-1">Supporto upload multiplo</div>
              </div>
            </div>

            {/* Feedback upload */}
            {uploadingFiles.length > 0 && (
              <div className="bg-[#18181b] rounded-xl border border-[#27272a] p-4 space-y-2">
                <div className="text-xs font-bold text-[#a1a1aa] uppercase tracking-wider">Upload in corso</div>
                {uploadingFiles.map(file => (
                  <div key={file.name} className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-[200px]">{file.name}</span>
                    <span className="text-xs">
                      {file.status === 'pending' && <span className="text-yellow-400">📤 in coda</span>}
                      {file.status === 'uploading' && <span className="text-blue-400 animate-pulse">⏳ caricamento...</span>}
                      {file.status === 'success' && <span className="text-emerald-400">✅ completato</span>}
                      {file.status === 'error' && <span className="text-red-400">❌ errore</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Filtri skill */}
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

            {/* Tabella candidati con checkbox + PAGINAZIONE */}
            <div className="bg-[#18181b] rounded-3xl border border-[#27272a] overflow-hidden shadow-2xl">
              <table className="w-full text-left">
                <thead className="bg-[#27272a]/50 text-[#a1a1aa] text-[10px] uppercase tracking-widest font-bold">
                  <tr>
                    <th className="p-4 w-8">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-[#27272a] bg-[#09090b] text-indigo-600 focus:ring-indigo-500"
                        checked={allSelected}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                      />
                    </th>
                    <th className="p-6">Nominativo</th>
                    <th className="p-6">Stato Pipeline</th>
                    <th className="p-6">Azioni</th>
                    <th className="p-6 text-right">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272a]">
                  {paginatedCandidates.map(c => (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-4 w-8">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-[#27272a] bg-[#09090b] text-indigo-600 focus:ring-indigo-500"
                          checked={selectedCandidates.has(c.id)}
                          onChange={(e) => toggleSelectOne(c.id, e.target.checked)}
                        />
                      </td>
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
                          <button onClick={() => {
                            setSelectedCandidates(new Set([c.id]));
                            setShowDeleteModal(true);
                          }} className="p-2 hover:bg-red-500/20 rounded-lg text-red-500 transition-colors" title="Elimina (GDPR)">
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

              {/* PAGINAZIONE CANDIDATI */}
              {filteredCandidates.length > 0 && (
                <div className="px-6 pb-6">
                  <Pagination
                    currentPage={candidatesPage}
                    totalPages={totalCandidatePages}
                    onPageChange={setCandidatesPage}
                    totalItems={filteredCandidates.length}
                    itemsPerPage={CANDIDATES_PER_PAGE}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========= MODALE CONFERMA ELIMINAZIONE ========= */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-500/20 rounded-full">
                  <Trash2 className="text-red-400" size={24} />
                </div>
                <h3 className="text-xl font-bold text-white">Conferma eliminazione</h3>
              </div>
              <p className="text-[#a1a1aa] mb-6">
                Sei sicuro di voler eliminare <span className="font-bold text-white">{selectedCandidates.size}</span> candidato{selectedCandidates.size !== 1 && 'i'}?
                {selectedCandidates.size > 0 && (
                  <span className="block text-xs text-red-400 mt-2">Questa operazione è irreversibile (GDPR).</span>
                )}
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 rounded-xl bg-[#27272a] hover:bg-[#3f3f46] text-white transition" disabled={isDeleting}>Annulla</button>
                <button onClick={handleDeleteSelected} className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition flex items-center gap-2" disabled={isDeleting}>
                  {isDeleting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Eliminazione...</> : <>Conferma eliminazione</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========= MODALE NUOVO COLLOQUIO ========= */}
        {showNewInterviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/20 rounded-full">
                    <Calendar className="text-indigo-400" size={22} />
                  </div>
                  <h3 className="text-xl font-bold text-white">Nuovo Colloquio</h3>
                </div>
                <button
                  onClick={() => setShowNewInterviewModal(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition text-[#a1a1aa]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Selezione candidato */}
                <div>
                  <label className="block text-xs font-bold text-[#a1a1aa] uppercase tracking-wider mb-2">
                    Candidato
                  </label>
                  <select
                    value={newInterviewForm.candidateId}
                    onChange={e => setNewInterviewForm({ ...newInterviewForm, candidateId: e.target.value })}
                    className="w-full bg-[#09090b] border border-[#27272a] text-white p-3 rounded-xl text-sm outline-none focus:border-indigo-500 transition-all"
                  >
                    <option value="" className="bg-[#09090b] text-[#71717a]">— Seleziona un candidato —</option>
                    {candidates.map(c => (
                      <option key={c.id} value={c.id} className="bg-[#09090b]">
                        {c.name || c.email}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Data */}
                <div>
                  <label className="block text-xs font-bold text-[#a1a1aa] uppercase tracking-wider mb-2">
                    Data
                  </label>
                  <input
                    type="date"
                    value={newInterviewForm.date}
                    onChange={e => setNewInterviewForm({ ...newInterviewForm, date: e.target.value })}
                    className="w-full bg-[#09090b] border border-[#27272a] text-white p-3 rounded-xl text-sm outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                {/* Ora */}
                <div>
                  <label className="block text-xs font-bold text-[#a1a1aa] uppercase tracking-wider mb-2">
                    Ora
                  </label>
                  <input
                    type="time"
                    value={newInterviewForm.time}
                    onChange={e => setNewInterviewForm({ ...newInterviewForm, time: e.target.value })}
                    className="w-full bg-[#09090b] border border-[#27272a] text-white p-3 rounded-xl text-sm outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                {/* Tipo di colloquio */}
                <div>
                  <label className="block text-xs font-bold text-[#a1a1aa] uppercase tracking-wider mb-2">
                    Tipo di colloquio
                  </label>
                  <select
                    value={newInterviewForm.type}
                    onChange={e => setNewInterviewForm({ ...newInterviewForm, type: e.target.value })}
                    className="w-full bg-[#09090b] border border-[#27272a] text-white p-3 rounded-xl text-sm outline-none focus:border-indigo-500 transition-all"
                  >
                    <option value="Colloquio tecnico" className="bg-[#09090b]">Colloquio tecnico</option>
                    <option value="Colloquio HR" className="bg-[#09090b]">Colloquio HR</option>
                    <option value="Colloquio conoscitivo" className="bg-[#09090b]">Colloquio conoscitivo</option>
                    <option value="Colloquio finale" className="bg-[#09090b]">Colloquio finale</option>
                  </select>
                </div>

                {/* Errore di validazione */}
                {newInterviewError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle size={14} /> {newInterviewError}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowNewInterviewModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#27272a] hover:bg-[#3f3f46] text-white transition"
                >
                  Annulla
                </button>
                <button
                  onClick={handleAddInterview}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition flex items-center gap-2"
                >
                  <Plus size={16} /> Aggiungi colloquio
                </button>
              </div>
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

        {/* ========= VIEW 6: COLLOQUI con FILTRI, CANCELLAZIONE e PAGINAZIONE ========= */}
        {view === 'calendar' && (
          <div className="bg-[#18181b] rounded-3xl border border-[#27272a] p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Calendar className="text-indigo-400" size={24} />Prossimi Colloqui
                </h2>
                <p className="text-[#a1a1aa] text-sm mt-1">
                  {filteredInterviews.length > 0
                    ? `${filteredInterviews.length} colloqui${allInterviews.length !== filteredInterviews.length ? ` su ${allInterviews.length}` : ' programmati'}`
                    : 'Nessun colloquio corrisponde ai filtri'}
                </p>
              </div>
              <button onClick={() => { setNewInterviewForm({ candidateId: '', date: '', time: '', type: 'Colloquio tecnico' }); setNewInterviewError(''); setShowNewInterviewModal(true); }} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-xl flex items-center gap-2 transition">
                <Plus size={16} /> Nuovo colloquio
              </button>
            </div>

            {/* Barra filtri colloqui */}
            <div className="flex gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a]" size={15} />
                <input
                  type="text"
                  placeholder="Cerca per nome o email candidato..."
                  value={interviewSearchTerm}
                  onChange={e => setInterviewSearchTerm(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] py-2.5 pl-9 pr-4 rounded-xl text-sm outline-none focus:border-indigo-500 transition-all text-white"
                />
              </div>
              <select
                value={interviewTypeFilter}
                onChange={e => setInterviewTypeFilter(e.target.value)}
                className="bg-[#09090b] border border-[#27272a] text-sm text-[#a1a1aa] py-2.5 px-4 rounded-xl outline-none focus:border-indigo-500 transition-all"
              >
                <option value="">Tutti i tipi</option>
                <option value="Colloquio tecnico">Colloquio tecnico</option>
                <option value="Colloquio HR">Colloquio HR</option>
                <option value="Colloquio conoscitivo">Colloquio conoscitivo</option>
                <option value="Colloquio finale">Colloquio finale</option>
              </select>
              {(interviewSearchTerm !== '' || interviewTypeFilter !== '') && (
                <button
                  onClick={() => { setInterviewSearchTerm(''); setInterviewTypeFilter(''); }}
                  className="text-[#a1a1aa] hover:text-white bg-[#09090b] border border-[#27272a] px-3 rounded-xl flex items-center gap-1.5 text-xs transition-all hover:border-indigo-500/50"
                >
                  <X size={13} /> Reset
                </button>
              )}
            </div>

            {allInterviews.length === 0 ? (
              <div className="text-center text-[#71717a] py-12">
                Nessun colloquio programmato. Aggiungine uno!
              </div>
            ) : filteredInterviews.length === 0 ? (
              <div className="text-center text-[#71717a] py-12">
                Nessun colloquio corrisponde ai filtri selezionati.
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {paginatedInterviews.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-4 bg-[#09090b] rounded-xl border border-[#27272a] hover:border-indigo-500/40 transition group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-sm">
                          {c.candidateName?.charAt(0) || '?'}
                        </div>
                        <div>
                          <div className="font-medium text-white">{c.candidateName}</div>
                          <div className="text-xs text-[#71717a]">{c.candidateEmail}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-indigo-400 text-xs font-semibold">{c.time}</div>
                          <div className="text-[10px] text-[#71717a]">{c.type}</div>
                        </div>
                        <button
                          onClick={() => { setInterviewToDelete(c); setShowDeleteInterviewModal(true); }}
                          className="p-2 hover:bg-red-500/20 rounded-lg text-[#71717a] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          title="Cancella colloquio"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* PAGINAZIONE COLLOQUI */}
                <Pagination
                  currentPage={interviewsPage}
                  totalPages={totalInterviewPages}
                  onPageChange={setInterviewsPage}
                  totalItems={filteredInterviews.length}
                  itemsPerPage={INTERVIEWS_PER_PAGE}
                />
              </>
            )}
          </div>
        )}

        {/* ========= MODALE CONFERMA CANCELLAZIONE COLLOQUIO ========= */}
        {showDeleteInterviewModal && interviewToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-500/20 rounded-full">
                  <Trash2 className="text-red-400" size={24} />
                </div>
                <h3 className="text-xl font-bold text-white">Cancella colloquio</h3>
              </div>
              <p className="text-[#a1a1aa] mb-2">
                Sei sicuro di voler cancellare il colloquio con <span className="font-bold text-white">{interviewToDelete.candidateName}</span>?
              </p>
              <p className="text-xs text-[#71717a] mb-6">
                {interviewToDelete.time} — {interviewToDelete.type}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowDeleteInterviewModal(false); setInterviewToDelete(null); }}
                  className="px-4 py-2 rounded-xl bg-[#27272a] hover:bg-[#3f3f46] text-white transition"
                >
                  Annulla
                </button>
                <button
                  onClick={handleDeleteInterview}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition flex items-center gap-2"
                >
                  <Trash2 size={15} /> Conferma cancellazione
                </button>
              </div>
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