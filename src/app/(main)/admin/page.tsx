"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { toast } from "sonner";
import { Trash2, Edit, UserPlus, Shield, ShieldCheck, User } from "lucide-react";

type UserRole = 'superadmin' | 'admin' | 'user';

function getRoleIcon(role: string) {
  switch (role) {
    case 'superadmin':
      return <ShieldCheck className="h-4 w-4" />;
    case 'admin':
      return <Shield className="h-4 w-4" />;
    default:
      return <User className="h-4 w-4" />;
  }
}

function getRoleBadgeVariant(role: string) {
  switch (role) {
    case 'superadmin':
      return 'destructive';
    case 'admin':
      return 'default';
    default:
      return 'secondary';
  }
}

export default function AdminManagementPage() {
  const [selectedRole, setSelectedRole] = useState<UserRole | 'all'>('all');
  const [search, setSearch] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user');

  // Get current user's role and permissions
  const { data: myRole } = api.admin.getMyRole.useQuery();
  
  // Get dashboard stats
  const { data: stats } = api.admin.getDashboardStats.useQuery();

  // Get managed users list
  const { data: usersData, refetch } = api.admin.listManagedUsers.useQuery({
    search: search || undefined,
    roleFilter: selectedRole === 'all' ? undefined : selectedRole,
  });

  // Mutations
  const updateRoleMutation = api.admin.updateUserRole.useMutation({
    onSuccess: () => {
      toast.success('User role updated successfully');
      void refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteUserMutation = api.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.success('User deleted successfully');
      void refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const createUserMutation = api.admin.createUser.useMutation({
    onSuccess: () => {
      toast.success('User created successfully');
      setIsCreateDialogOpen(false);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserRole('user');
      void refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    updateRoleMutation.mutate({ userId, newRole });
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      deleteUserMutation.mutate({ userId });
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserName.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    createUserMutation.mutate({
      email: newUserEmail.trim(),
      fullName: newUserName.trim(),
      role: newUserRole,
    });
  };

  // Check if user has admin access
  if (!myRole || !['admin', 'superadmin'].includes(myRole.role)) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-lg font-semibold">Access Denied</h3>
              <p className="text-muted-foreground">
                You need admin or superadmin privileges to access this page.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Management</h1>
          <p className="text-muted-foreground">
            Manage users and their roles in the system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getRoleBadgeVariant(myRole.role) as any}>
            {getRoleIcon(myRole.role)}
            <span className="ml-1">{myRole.role}</span>
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>
          {myRole.role === 'superadmin' && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Admins</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalAdmins}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Superadmins</CardTitle>
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalSuperadmins}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total All</CardTitle>
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalAll}</div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Filters and Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-64"
              />
              <Select
                value={selectedRole}
                onValueChange={(value: UserRole | 'all') => setSelectedRole(value)}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {myRole.managedRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select value={newUserRole} onValueChange={(value: 'admin' | 'user') => setNewUserRole(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {myRole.managedRoles.includes('user') && (
                          <SelectItem value="user">User</SelectItem>
                        )}
                        {myRole.managedRoles.includes('admin') && (
                          <SelectItem value="admin">Admin</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createUserMutation.isPending}>
                      {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>NIS</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersData?.data.length ? (
                usersData.data.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.fullName || 'No Name'}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role ?? 'user') as any}>
                        {getRoleIcon(user.role ?? 'user')}
                        <span className="ml-1">{user.role ?? 'user'}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>{user.className ?? '-'}</TableCell>
                    <TableCell>{user.nis ?? '-'}</TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Select
                          value={user.role ?? 'user'}
                          onValueChange={(value: UserRole) => handleRoleChange(user.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            {myRole.managedRoles.includes('admin') && (
                              <SelectItem value="admin">Admin</SelectItem>
                            )}
                            {myRole.role === 'superadmin' && (
                              <SelectItem value="superadmin">Superadmin</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={deleteUserMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}