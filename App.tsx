import { useEffect, useReducer, useState } from 'react';
import { User, Controller, Lamp, Analytics } from '@/types';
import { apiRequest } from '@/lib/supabase';
import { AuthPage } from '@/app/components/AuthPage';
import { Dashboard } from '@/app/components/Dashboard';
import { Toaster, toast } from 'sonner';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Switch } from '@/app/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import {
  Power,
  Lightbulb,
  Server,
  Users,
  Settings,
  Plus,
  Trash2,
  Calendar,
  LogOut,
  Edit,
  Wifi,
  WifiOff,
  Clock,
  Check,
  X
} from 'lucide-react';

type State = {
  user: User | null;
  token: string | null;
  controllers: Controller[];
  lamps: Lamp[];
  analytics: Analytics | null;
  users: User[];
};

type Action =
  | { type: 'SET_USER'; payload: { user: User; token: string } }
  | { type: 'LOGOUT' }
  | { type: 'SET_CONTROLLERS'; payload: Controller[] }
  | { type: 'SET_LAMPS'; payload: Lamp[] }
  | { type: 'SET_ANALYTICS'; payload: Analytics }
  | { type: 'SET_USERS'; payload: User[] }
  | { type: 'UPDATE_LAMP'; payload: Lamp };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload.user, token: action.payload.token };
    case 'LOGOUT':
      return { ...state, user: null, token: null };
    case 'SET_CONTROLLERS':
      return { ...state, controllers: action.payload };
    case 'SET_LAMPS':
      return { ...state, lamps: action.payload };
    case 'SET_ANALYTICS':
      return { ...state, analytics: action.payload };
    case 'SET_USERS':
      return { ...state, users: action.payload };
    case 'UPDATE_LAMP':
      return {
        ...state,
        lamps: state.lamps.map(l => l.id === action.payload.id ? action.payload : l)
      };
    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, {
    user: null,
    token: null,
    controllers: [],
    lamps: [],
    analytics: null,
    users: [],
  });

  const [activeTab, setActiveTab] = useState('devices');
  const [showControllerModal, setShowControllerModal] = useState(false);
  const [showLampModal, setShowLampModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedLamp, setSelectedLamp] = useState<Lamp | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [controllerForm, setControllerForm] = useState({ name: '', ip: '', model: 'ESP32' });
  const [lampForm, setLampForm] = useState({ name: '', pin: '', controllerId: '', brightness: 100, color: '#FFFFFF' });
  const [userForm, setUserForm] = useState({ username: '', email: '', password: '', role: 'user' as const });
  const [scheduleForm, setScheduleForm] = useState({ time: '00:00', action: 'on' as const });

  useEffect(() => {
    const storedToken = localStorage.getItem('lumina_token');
    const storedUser = localStorage.getItem('lumina_user');
    
    if (storedToken && storedUser) {
      dispatch({ type: 'SET_USER', payload: { user: JSON.parse(storedUser), token: storedToken } });
    }
  }, []);

  useEffect(() => {
    if (state.user) {
      loadData();
      const interval = setInterval(loadData, 10000);
      return () => clearInterval(interval);
    }
  }, [state.user]);

  const loadData = async () => {
    try {
      const [controllersData, lampsData, analyticsData, usersData] = await Promise.all([
        apiRequest('/controllers'),
        apiRequest('/lamps'),
        apiRequest('/analytics'),
        apiRequest('/users'),
      ]);

      dispatch({ type: 'SET_CONTROLLERS', payload: controllersData.controllers });
      dispatch({ type: 'SET_LAMPS', payload: lampsData.lamps });
      dispatch({ type: 'SET_ANALYTICS', payload: analyticsData.analytics });
      dispatch({ type: 'SET_USERS', payload: usersData.users });
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleLogin = (user: User, token: string) => {
    localStorage.setItem('lumina_token', token);
    localStorage.setItem('lumina_user', JSON.stringify(user));
    dispatch({ type: 'SET_USER', payload: { user, token } });
  };

  const handleLogout = () => {
    localStorage.removeItem('lumina_token');
    localStorage.removeItem('lumina_user');
    dispatch({ type: 'LOGOUT' });
    toast.success('Logged out successfully');
  };

  const createController = async () => {
    try {
      await apiRequest('/controllers', {
        method: 'POST',
        body: JSON.stringify({ ...controllerForm, ownerId: state.user?.id }),
      });
      toast.success('Controller created successfully');
      setShowControllerModal(false);
      setControllerForm({ name: '', ip: '', model: 'ESP32' });
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create controller');
    }
  };

  const createLamp = async () => {
    try {
      await apiRequest('/lamps', {
        method: 'POST',
        body: JSON.stringify({ ...lampForm, ownerId: state.user?.id }),
      });
      toast.success('Lamp created successfully');
      setShowLampModal(false);
      setLampForm({ name: '', pin: '', controllerId: '', brightness: 100, color: '#FFFFFF' });
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create lamp');
    }
  };

  const toggleLamp = async (lamp: Lamp) => {
    try {
      const data = await apiRequest(`/lamps/${lamp.id}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ userId: state.user?.id }),
      });
      dispatch({ type: 'UPDATE_LAMP', payload: data.lamp });
      toast.success(`Lamp ${data.lamp.status ? 'turned on' : 'turned off'}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to toggle lamp');
    }
  };

  const deleteLamp = async (lampId: number) => {
    try {
      await apiRequest(`/lamps/${lampId}`, { method: 'DELETE' });
      toast.success('Lamp deleted successfully');
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete lamp');
    }
  };

  const deleteController = async (controllerId: string) => {
    try {
      await apiRequest(`/controllers/${controllerId}`, { method: 'DELETE' });
      toast.success('Controller deleted successfully');
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete controller');
    }
  };

  const createUser = async () => {
    try {
      await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ ...userForm, createdBy: state.user?.id }),
      });
      toast.success('User created successfully');
      setShowUserModal(false);
      setUserForm({ username: '', email: '', password: '', role: 'user' });
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create user');
    }
  };

  const deleteUser = async (userId: number) => {
    try {
      await apiRequest(`/users/${userId}`, { method: 'DELETE' });
      toast.success('User deleted successfully');
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete user');
    }
  };

  const updateUserPermissions = async (userId: number, permissions: { allowedLamps: number[], allowedControllers: string[] }) => {
    try {
      await apiRequest(`/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(permissions),
      });
      toast.success('Permissions updated successfully');
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update permissions');
    }
  };

  const addSchedule = async () => {
    if (!selectedLamp) return;
    
    try {
      await apiRequest(`/lamps/${selectedLamp.id}/schedules`, {
        method: 'POST',
        body: JSON.stringify(scheduleForm),
      });
      toast.success('Schedule added successfully');
      setShowScheduleModal(false);
      setScheduleForm({ time: '00:00', action: 'on' });
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add schedule');
    }
  };

  const deleteSchedule = async (lampId: number, scheduleId: string) => {
    try {
      await apiRequest(`/lamps/${lampId}/schedules/${scheduleId}`, {
        method: 'DELETE',
      });
      toast.success('Schedule deleted successfully');
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete schedule');
    }
  };

  if (!state.user) {
    return (
      <>
        <AuthPage onLogin={handleLogin} />
        <Toaster position="top-right" theme="dark" />
      </>
    );
  }

  const lampsGroupedByController = state.lamps.reduce((acc, lamp) => {
    if (!acc[lamp.controllerId]) {
      acc[lamp.controllerId] = [];
    }
    acc[lamp.controllerId].push(lamp);
    return acc;
  }, {} as Record<string, Lamp[]>);

  return (
    <div className="min-h-screen bg-[#020617]">
      <Toaster position="top-right" theme="dark" />
      
      {/* Header */}
      <div className="border-b border-white/5 bg-slate-900/50 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Power className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white">LUMINA</h1>
                <p className="text-xs text-white/60">Smart Lighting Control</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-white">{state.user.username}</p>
                <p className="text-xs text-white/60 capitalize">{state.user.role.replace('_', ' ')}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="rounded-xl"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-1 rounded-2xl">
            <TabsTrigger value="dashboard" className="rounded-xl gap-2">
              <Settings className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="devices" className="rounded-xl gap-2">
              <Lightbulb className="w-4 h-4" />
              Devices
            </TabsTrigger>
            <TabsTrigger value="controllers" className="rounded-xl gap-2">
              <Server className="w-4 h-4" />
              Controllers
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-xl gap-2">
              <Users className="w-4 h-4" />
              Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <Dashboard analytics={state.analytics} />
          </TabsContent>

          <TabsContent value="devices">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black text-white mb-2">Devices</h2>
                  <p className="text-white/60">Manage your smart lamps</p>
                </div>
                <Button
                  onClick={() => setShowLampModal(true)}
                  className="rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Lamp
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {state.lamps.map((lamp) => {
                  const controller = state.controllers.find(c => c.id === lamp.controllerId);
                  
                  return (
                    <Card
                      key={lamp.id}
                      className={`bg-slate-900/50 backdrop-blur-xl border-white/5 p-6 rounded-3xl transition-all ${
                        lamp.status ? 'shadow-lg shadow-indigo-500/30 border-indigo-500/30' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-black text-white">{lamp.name}</h3>
                          <p className="text-sm text-white/60">Pin: {lamp.pin}</p>
                          {controller && (
                            <p className="text-xs text-white/40">{controller.name}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleLamp(lamp)}
                          className={`rounded-xl ${
                            lamp.status
                              ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                              : 'bg-white/5 hover:bg-white/10'
                          }`}
                        >
                          <Lightbulb className={`w-5 h-5 ${lamp.status ? 'fill-white' : ''}`} />
                        </Button>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white/60">Status:</span>
                          <span className={`font-medium ${lamp.status ? 'text-emerald-400' : 'text-white/40'}`}>
                            {lamp.status ? 'On' : 'Off'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white/60">Brightness:</span>
                          <span className="text-white">{lamp.brightness}%</span>
                        </div>
                        {lamp.schedules.length > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-purple-400" />
                            <span className="text-white/60">{lamp.schedules.length} schedule(s)</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedLamp(lamp);
                            setShowScheduleModal(true);
                          }}
                          className="flex-1 rounded-xl text-xs"
                        >
                          <Clock className="w-3 h-3 mr-1" />
                          Schedule
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteLamp(lamp.id)}
                          className="rounded-xl text-xs text-rose-400 hover:text-rose-300"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {state.lamps.length === 0 && (
                <Card className="bg-slate-900/50 backdrop-blur-xl border-white/5 p-12 rounded-3xl">
                  <div className="text-center">
                    <Lightbulb className="w-16 h-16 text-white/20 mx-auto mb-4" />
                    <h3 className="text-xl font-black text-white mb-2">No lamps yet</h3>
                    <p className="text-white/60 mb-4">Add your first lamp to get started</p>
                    <Button
                      onClick={() => setShowLampModal(true)}
                      className="rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Lamp
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="controllers">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black text-white mb-2">Controllers</h2>
                  <p className="text-white/60">Manage ESP32/ESP8266 devices</p>
                </div>
                <Button
                  onClick={() => setShowControllerModal(true)}
                  className="rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Controller
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {state.controllers.map((controller) => (
                  <Card
                    key={controller.id}
                    className="bg-slate-900/50 backdrop-blur-xl border-white/5 p-6 rounded-3xl"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-black text-white">{controller.name}</h3>
                        <p className="text-sm font-mono text-white/60">{controller.ip}</p>
                        <p className="text-xs text-white/40">{controller.model}</p>
                      </div>
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-xl ${
                        controller.isOnline
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {controller.isOnline ? (
                          <Wifi className="w-4 h-4" />
                        ) : (
                          <WifiOff className="w-4 h-4" />
                        )}
                        <span className="text-xs font-medium">
                          {controller.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/60">Lamps:</span>
                        <span className="text-white">
                          {lampsGroupedByController[controller.id]?.length || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/60">Last Seen:</span>
                        <span className="text-white/40 text-xs">
                          {new Date(controller.lastSeen).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteController(controller.id)}
                      className="w-full rounded-xl text-rose-400 hover:text-rose-300"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Controller
                    </Button>
                  </Card>
                ))}
              </div>

              {state.controllers.length === 0 && (
                <Card className="bg-slate-900/50 backdrop-blur-xl border-white/5 p-12 rounded-3xl">
                  <div className="text-center">
                    <Server className="w-16 h-16 text-white/20 mx-auto mb-4" />
                    <h3 className="text-xl font-black text-white mb-2">No controllers yet</h3>
                    <p className="text-white/60 mb-4">Add your first controller to get started</p>
                    <Button
                      onClick={() => setShowControllerModal(true)}
                      className="rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Controller
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="users">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black text-white mb-2">Users</h2>
                  <p className="text-white/60">Manage system users and permissions</p>
                </div>
                {state.user.role === 'super_admin' || state.user.role === 'admin' ? (
                  <Button
                    onClick={() => setShowUserModal(true)}
                    className="rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add User
                  </Button>
                ) : null}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {state.users.map((user) => (
                  <Card
                    key={user.id}
                    className="bg-slate-900/50 backdrop-blur-xl border-white/5 p-6 rounded-3xl"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-black text-white">{user.username}</h3>
                        <p className="text-sm text-white/60">{user.email}</p>
                      </div>
                      <div className="px-3 py-1 rounded-xl bg-indigo-500/20 text-indigo-400 text-xs font-medium capitalize">
                        {user.role.replace('_', ' ')}
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/60">Allowed Lamps:</span>
                        <span className="text-white">{user.allowedLamps.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/60">Controllers:</span>
                        <span className="text-white">{user.allowedControllers.length}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {state.user.role === 'super_admin' || state.user.role === 'admin' ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedUser(user);
                            }}
                            className="flex-1 rounded-xl text-xs"
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Permissions
                          </Button>
                          {user.id !== 1 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteUser(user.id)}
                              className="rounded-xl text-xs text-rose-400 hover:text-rose-300"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </>
                      ) : null}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <Dialog open={showControllerModal} onOpenChange={setShowControllerModal}>
        <DialogContent className="bg-slate-900 border-white/10 rounded-[40px] text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Add Controller</DialogTitle>
            <DialogDescription className="text-white/60">Enter the details for the new controller.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={controllerForm.name}
                onChange={(e) => setControllerForm({ ...controllerForm, name: e.target.value })}
                className="rounded-2xl bg-white/5 border-white/10"
                placeholder="Living Room Controller"
              />
            </div>
            <div className="space-y-2">
              <Label>IP Address</Label>
              <Input
                value={controllerForm.ip}
                onChange={(e) => setControllerForm({ ...controllerForm, ip: e.target.value })}
                className="rounded-2xl bg-white/5 border-white/10 font-mono"
                placeholder="192.168.1.100"
              />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Select
                value={controllerForm.model}
                onValueChange={(value) => setControllerForm({ ...controllerForm, model: value })}
              >
                <SelectTrigger className="rounded-2xl bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10">
                  <SelectItem value="ESP32">ESP32</SelectItem>
                  <SelectItem value="ESP8266">ESP8266</SelectItem>
                  <SelectItem value="ESP32-S2">ESP32-S2</SelectItem>
                  <SelectItem value="ESP32-C3">ESP32-C3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={createController} className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600">
              Create Controller
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showLampModal} onOpenChange={setShowLampModal}>
        <DialogContent className="bg-slate-900 border-white/10 rounded-[40px] text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Add Lamp</DialogTitle>
            <DialogDescription className="text-white/60">Connect a new lamp to your system.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={lampForm.name}
                onChange={(e) => setLampForm({ ...lampForm, name: e.target.value })}
                className="rounded-2xl bg-white/5 border-white/10"
                placeholder="Main Light"
              />
            </div>
            <div className="space-y-2">
              <Label>Controller</Label>
              <Select
                value={lampForm.controllerId}
                onValueChange={(value) => setLampForm({ ...lampForm, controllerId: value })}
              >
                <SelectTrigger className="rounded-2xl bg-white/5 border-white/10">
                  <SelectValue placeholder="Select controller" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10">
                  {state.controllers.map((controller) => (
                    <SelectItem key={controller.id} value={controller.id}>
                      {controller.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>GPIO Pin</Label>
              <Input
                value={lampForm.pin}
                onChange={(e) => setLampForm({ ...lampForm, pin: e.target.value })}
                className="rounded-2xl bg-white/5 border-white/10 font-mono"
                placeholder="GPIO23"
              />
            </div>
            <div className="space-y-2">
              <Label>Brightness (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={lampForm.brightness}
                onChange={(e) => setLampForm({ ...lampForm, brightness: parseInt(e.target.value) || 0 })}
                className="rounded-2xl bg-white/5 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <Input
                type="color"
                value={lampForm.color}
                onChange={(e) => setLampForm({ ...lampForm, color: e.target.value })}
                className="rounded-2xl bg-white/5 border-white/10 h-12"
              />
            </div>
            <Button onClick={createLamp} className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600">
              Create Lamp
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
        <DialogContent className="bg-slate-900 border-white/10 rounded-[40px] text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Add User</DialogTitle>
            <DialogDescription className="text-white/60">Create a new user account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={userForm.username}
                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                className="rounded-2xl bg-white/5 border-white/10"
                placeholder="johndoe"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                className="rounded-2xl bg-white/5 border-white/10"
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                className="rounded-2xl bg-white/5 border-white/10"
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={userForm.role}
                onValueChange={(value: any) => setUserForm({ ...userForm, role: value })}
              >
                <SelectTrigger className="rounded-2xl bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10">
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  {state.user.role === 'super_admin' && (
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={createUser} className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600">
              Create User
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showScheduleModal} onOpenChange={setShowScheduleModal}>
        <DialogContent className="bg-slate-900 border-white/10 rounded-[40px] text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Add Schedule</DialogTitle>
            {selectedLamp && (
              <DialogDescription className="text-white/60 text-sm">For: {selectedLamp.name}</DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedLamp?.schedules && selectedLamp.schedules.length > 0 && (
              <div className="space-y-2">
                <Label>Existing Schedules</Label>
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {selectedLamp.schedules.map((schedule) => (
                      <div
                        key={schedule.id}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-2xl"
                      >
                        <div>
                          <p className="text-sm font-medium text-white">{schedule.time}</p>
                          <p className="text-xs text-white/60 capitalize">{schedule.action}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-lg ${
                            schedule.enabled
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-white/10 text-white/40'
                          }`}>
                            {schedule.enabled ? 'Active' : 'Inactive'}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteSchedule(selectedLamp.id, schedule.id)}
                            className="h-8 w-8 rounded-xl text-rose-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={scheduleForm.time}
                onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                className="rounded-2xl bg-white/5 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label>Action</Label>
              <Select
                value={scheduleForm.action}
                onValueChange={(value: 'on' | 'off') => setScheduleForm({ ...scheduleForm, action: value })}
              >
                <SelectTrigger className="rounded-2xl bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10">
                  <SelectItem value="on">Turn On</SelectItem>
                  <SelectItem value="off">Turn Off</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addSchedule} className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600">
              Add Schedule
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permission Modal */}
      {selectedUser && (
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="bg-slate-900 border-white/10 rounded-[40px] text-white max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black">Manage Permissions</DialogTitle>
              <DialogDescription className="text-white/60">For: {selectedUser.username}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Allowed Controllers</Label>
                <ScrollArea className="h-32 rounded-2xl border border-white/10 p-3">
                  <div className="space-y-2">
                    {state.controllers.map((controller) => {
                      const isAllowed = selectedUser.allowedControllers.includes(controller.id);
                      return (
                        <div
                          key={controller.id}
                          className="flex items-center justify-between p-2 bg-white/5 rounded-xl"
                        >
                          <span className="text-sm">{controller.name}</span>
                          <Switch
                            checked={isAllowed}
                            onCheckedChange={(checked) => {
                              const newControllers = checked
                                ? [...selectedUser.allowedControllers, controller.id]
                                : selectedUser.allowedControllers.filter(id => id !== controller.id);
                              updateUserPermissions(selectedUser.id, {
                                allowedControllers: newControllers,
                                allowedLamps: selectedUser.allowedLamps
                              });
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              <div className="space-y-2">
                <Label>Allowed Lamps</Label>
                <ScrollArea className="h-32 rounded-2xl border border-white/10 p-3">
                  <div className="space-y-2">
                    {state.lamps.map((lamp) => {
                      const isAllowed = selectedUser.allowedLamps.includes(lamp.id);
                      return (
                        <div
                          key={lamp.id}
                          className="flex items-center justify-between p-2 bg-white/5 rounded-xl"
                        >
                          <span className="text-sm">{lamp.name}</span>
                          <Switch
                            checked={isAllowed}
                            onCheckedChange={(checked) => {
                              const newLamps = checked
                                ? [...selectedUser.allowedLamps, lamp.id]
                                : selectedUser.allowedLamps.filter(id => id !== lamp.id);
                              updateUserPermissions(selectedUser.id, {
                                allowedControllers: selectedUser.allowedControllers,
                                allowedLamps: newLamps
                              });
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
