/* =========================
   SEGMENT 01/15 — Imports & types
   ========================= */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import {
  LogOut,
  Users,
  UserPlus,
  Tag,
  Pencil,
  Trash2,
  X,
  Check,
  Image as ImageIcon,
  User as UserIcon,
  Shield,
} from 'lucide-react';
import { Database } from '../lib/types';

type WorkspaceMember = Database['public']['Tables']['workspace_members']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type Workspace = Database['public']['Tables']['workspaces']['Row'];

type ProfileMini = { email?: string | null; full_name?: string | null };
type MemberVM = WorkspaceMember & { profile: ProfileMini | null };

/* =========================
   SEGMENT 02/15 — Helpers: error detection
   ========================= */
function isMissingColumnError(err: any) {
  return err?.code === '42703' || String(err?.message || '').toLowerCase().includes('does not exist');
}

/* =========================
   SEGMENT 03/15 — Helpers: profile id column detection
   ========================= */
async function detectProfileIdColumn(): Promise<'user_id' | 'id' | 'uid' | null> {
  const candidates = ['user_id', 'id', 'uid'] as const;
  for (const col of candidates) {
    const { error } = await supabase.from('profiles').select(`${col}`).limit(1);
    if (!error) return col;
    if (!isMissingColumnError(error)) return null;
  }
  return null;
}

/* =========================
   SEGMENT 04/15 — Helpers: profiles map fetch
   ========================= */
async function fetchProfilesMap(
  idCol: 'user_id' | 'id' | 'uid',
  userIds: string[]
): Promise<Map<string, ProfileMini>> {
  if (!userIds.length) return new Map();

  const { data, error } = await supabase
    .from('profiles')
    .select(`${idCol}, email, full_name`)
    // @ts-ignore dynamic column
    .in(idCol, userIds);

  if (error) throw error;

  const map = new Map<string, ProfileMini>();
  (data || []).forEach((r: any) => {
    map.set(r[idCol], { email: r.email ?? null, full_name: r.full_name ?? null });
  });
  return map;
}

/* =========================
   SEGMENT 05/15 — Component: shell + permissions
   ========================= */
export default function Settings() {
  const { user, signOut } = useAuth();
  const { activeWorkspace, activeWorkspaceId, membership } = useWorkspace();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Permissions (pragmatic)
  const canManageMembers = useMemo(() => Boolean(membership?.can_manage_members), [membership]);
  const canManageCategories = useMemo(() => Boolean(membership?.can_manage_members), [membership]);
  const canManageWorkspace = useMemo(() => Boolean(membership?.can_manage_members), [membership]);

/* =========================
   SEGMENT 06/15 — Profiles key col detection state/effect
   ========================= */
  const [profilesKeyCol, setProfilesKeyCol] = useState<'user_id' | 'id' | 'uid' | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const col = await detectProfileIdColumn();
        setProfilesKeyCol(col);
      } catch (e: any) {
        console.error(e);
        setProfilesKeyCol(null);
      }
    })();
  }, []);

/* =========================
   SEGMENT 07/15 — Members: state
   ========================= */
  const [members, setMembers] = useState<MemberVM[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const [email, setEmail] = useState('');
  const [allowPriorityAdjustments, setAllowPriorityAdjustments] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

/* =========================
   SEGMENT 08/15 — Members: fetchMembers
   ========================= */
  const fetchMembers = useCallback(async () => {
    if (!activeWorkspaceId) return;

    setLoadingMembers(true);
    try {
      const { data: memberRows, error } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', activeWorkspaceId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const base = (memberRows || []) as WorkspaceMember[];

      if (!profilesKeyCol) {
        setMembers(base.map((m) => ({ ...m, profile: null })));
        return;
      }

      const userIds = base.map((m) => m.user_id).filter(Boolean);
      let map = new Map<string, ProfileMini>();
      try {
        map = await fetchProfilesMap(profilesKeyCol, userIds);
      } catch (err) {
        console.error('profiles fetch failed', err);
        map = new Map();
      }

      setMembers(base.map((m) => ({ ...m, profile: map.get(m.user_id) ?? null })));
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to load members', 'error');
    } finally {
      setLoadingMembers(false);
    }
  }, [activeWorkspaceId, profilesKeyCol, showToast]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

/* =========================
   SEGMENT 09/15 — Members: display name + add/update handlers
   ========================= */
  const displayMemberName = (m: MemberVM) => {
    if (m.user_id === user?.id) return 'You';
    const full = m.profile?.full_name?.trim();
    if (full) return full;
    const mail = m.profile?.email?.trim();
    if (mail) return mail;
    return m.user_id;
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId) return;

    const clean = email.trim().toLowerCase();
    if (!clean) {
      showToast('Please enter an email address', 'error');
      return;
    }

    setAddingMember(true);
    try {
      const { error } = await supabase.rpc('add_member_by_email', {
        p_workspace_id: activeWorkspaceId,
        p_email: clean,
        p_can_set_p0: allowPriorityAdjustments,
      });

      if (error) throw error;

      showToast('Member added', 'success');
      setEmail('');
      setAllowPriorityAdjustments(false);
      await fetchMembers();
    } catch (err: any) {
      showToast(err?.message || 'Failed to add member', 'error');
    } finally {
      setAddingMember(false);
    }
  };

  const updateMember = async (memberUserId: string, patch: Partial<WorkspaceMember>) => {
    if (!activeWorkspaceId) return;
    setUpdatingMemberId(memberUserId);

    try {
      const { error } = await supabase
        .from('workspace_members')
        .update(patch)
        .eq('workspace_id', activeWorkspaceId)
        .eq('user_id', memberUserId);

      if (error) throw error;
      showToast('Member updated', 'success');
      await fetchMembers();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update member', 'error');
    } finally {
      setUpdatingMemberId(null);
    }
  };

/* =========================
   SEGMENT 10/15 — Categories: state + fetch
   ========================= */
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setLoadingCategories(true);

    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('workspace_id', activeWorkspaceId)
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories((data || []) as Category[]);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load categories', 'error');
    } finally {
      setLoadingCategories(false);
    }
  }, [activeWorkspaceId, showToast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

/* =========================
   SEGMENT 11/15 — Categories: CRUD handlers
   ========================= */
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId) return;

    const name = newCategoryName.trim();
    if (!name) {
      showToast('Category name is required', 'error');
      return;
    }

    setAddingCategory(true);
    try {
      if (!user?.id) {
        showToast('You must be signed in to add a category', 'error');
        return;
      }

      const { error } = await supabase.from('categories').insert({
        workspace_id: activeWorkspaceId,
        name,
        created_by: user.id,
      });

      if (error) throw error;

      showToast('Category added', 'success');
      setNewCategoryName('');
      await fetchCategories();
    } catch (err: any) {
      showToast(err?.message || 'Failed to add category', 'error');
    } finally {
      setAddingCategory(false);
    }
  };

  const startEditCategory = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setEditingCategoryName(cat.name || '');
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditingCategoryName('');
  };

  const saveEditCategory = async () => {
    if (!editingCategoryId) return;
    const name = editingCategoryName.trim();
    if (!name) {
      showToast('Category name is required', 'error');
      return;
    }

    setSavingCategory(true);
    try {
      const { error } = await supabase.from('categories').update({ name }).eq('id', editingCategoryId);
      if (error) throw error;

      showToast('Category updated', 'success');
      cancelEditCategory();
      await fetchCategories();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update category', 'error');
    } finally {
      setSavingCategory(false);
    }
  };

  const deleteCategory = async (catId: string) => {
    if (!confirm('Delete this category? Tasks will keep their category empty.')) return;

    setDeletingCategoryId(catId);
    try {
      const { error } = await supabase.from('categories').delete().eq('id', catId);
      if (error) throw error;

      showToast('Category deleted', 'success');
      if (editingCategoryId === catId) cancelEditCategory();
      await fetchCategories();
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete category', 'error');
    } finally {
      setDeletingCategoryId(null);
    }
  };

/* =========================
   SEGMENT 12/15 — Workspace settings: state + save
   ========================= */
  const [wsName, setWsName] = useState('');
  const [wsPhotoUrl, setWsPhotoUrl] = useState('');
  const [savingWorkspace, setSavingWorkspace] = useState(false);

  useEffect(() => {
    setWsName(activeWorkspace?.name || '');
    setWsPhotoUrl((activeWorkspace as any)?.photo_url || '');
  }, [activeWorkspace?.name, activeWorkspaceId]);

  const saveWorkspace = async () => {
    if (!activeWorkspaceId) return;

    const name = wsName.trim();
    if (!name) {
      showToast('Workspace name is required', 'error');
      return;
    }

    setSavingWorkspace(true);
    try {
      const patch: any = { name, photo_url: wsPhotoUrl.trim() ? wsPhotoUrl.trim() : null };
      let { error } = await supabase.from('workspaces').update(patch).eq('id', activeWorkspaceId);

      if (error && isMissingColumnError(error)) {
        const retry = await supabase
          .from('workspaces')
          .update({ name } as Partial<Workspace>)
          .eq('id', activeWorkspaceId);
        error = retry.error;
      }
      if (error) throw error;

      showToast('Workspace updated', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update workspace', 'error');
    } finally {
      setSavingWorkspace(false);
    }
  };

/* =========================
   SEGMENT 13/15 — Profile settings: state + load/save
   ========================= */
  const [profileName, setProfileName] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const loadMyProfile = useCallback(async () => {
    if (!user || !profilesKeyCol) return;
    setLoadingProfile(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        // @ts-ignore dynamic column
        .eq(profilesKeyCol, user.id)
        .maybeSingle();

      if (error) throw error;
      setProfileName((data as any)?.full_name || '');
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingProfile(false);
    }
  }, [user, profilesKeyCol]);

  useEffect(() => {
    loadMyProfile();
  }, [loadMyProfile]);

  const saveMyProfile = async () => {
    if (!user || !profilesKeyCol) return;

    const full = profileName.trim();
    setSavingProfile(true);

    try {
      const { data: exists, error: readErr } = await supabase
        .from('profiles')
        .select(profilesKeyCol)
        // @ts-ignore dynamic column
        .eq(profilesKeyCol, user.id)
        .maybeSingle();

      if (readErr) throw readErr;

      if ((exists as any)?.[profilesKeyCol]) {
        const { error } = await supabase
          .from('profiles')
          .update({ full_name: full || null })
          // @ts-ignore dynamic column
          .eq(profilesKeyCol, user.id);

        if (error) throw error;
      } else {
        const row: any = { full_name: full || null };
        row[profilesKeyCol] = user.id;
        if (typeof user.email !== 'undefined') row.email = user.email;

        const { error } = await supabase.from('profiles').insert(row);
        if (error) throw error;
      }

      showToast('Profile updated', 'success');
      await fetchMembers();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

/* =========================
   SEGMENT 14/15 — Account/navigation handlers
   ========================= */
  const handleSignOut = async () => {
    try {
      await signOut();
      showToast('Signed out successfully', 'success');
      navigate('/auth');
    } catch (err: any) {
      showToast(err?.message || 'Failed to sign out', 'error');
    }
  };

  const handleSwitchWorkspace = () => navigate('/workspace');

/* =========================
   SEGMENT 15/15 — Render (UI)
   ========================= */
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Workspace */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon size={20} className="text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">Workspace</h2>
          </div>

          {!activeWorkspaceId ? (
            <p className="text-gray-600">No active workspace selected.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Workspace name</label>
                <input
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  disabled={!canManageWorkspace}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Workspace photo URL</label>
                <input
                  value={wsPhotoUrl}
                  onChange={(e) => setWsPhotoUrl(e.target.value)}
                  disabled={!canManageWorkspace}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-1">For now: paste an image URL. Upload support comes next.</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleSwitchWorkspace}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Switch workspace
                </button>

                {canManageWorkspace ? (
                  <button
                    onClick={saveWorkspace}
                    disabled={savingWorkspace}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    {savingWorkspace ? 'Saving...' : 'Save workspace'}
                  </button>
                ) : (
                  <p className="text-sm text-gray-500 self-center">
                    You don’t have permission to edit workspace settings.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Categories */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Tag size={20} className="text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
          </div>

          {loadingCategories ? (
            <p className="text-gray-600">Loading categories...</p>
          ) : categories.length === 0 ? (
            <p className="text-gray-600">No categories yet</p>
          ) : (
            <div className="space-y-2 mb-6">
              {categories.map((cat) => {
                const isEditing = editingCategoryId === cat.id;

                return (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between gap-3 py-2 px-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          value={editingCategoryName}
                          onChange={(e) => setEditingCategoryName(e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          autoFocus
                        />
                      ) : (
                        <p className="text-sm font-medium text-gray-900 truncate">{cat.name}</p>
                      )}
                    </div>

                    {canManageCategories ? (
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={saveEditCategory}
                              disabled={savingCategory}
                              className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-50"
                              title="Save"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditCategory}
                              disabled={savingCategory}
                              className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-50"
                              title="Cancel"
                            >
                              <X size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditCategory(cat)}
                              className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100"
                              title="Edit"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteCategory(cat.id)}
                              disabled={deletingCategoryId === cat.id}
                              className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {canManageCategories ? (
            <form onSubmit={handleAddCategory} className="border-t pt-5 space-y-3 max-w-md">
              <div className="flex items-center gap-2">
                <input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="New category name"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={addingCategory}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {addingCategory ? 'Adding...' : 'Add'}
                </button>
              </div>
              <p className="text-xs text-gray-500">Managers can add, rename, and delete categories.</p>
            </form>
          ) : (
            <p className="text-sm text-gray-500">You don’t have permission to manage categories in this workspace.</p>
          )}
        </div>

        {/* Members */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users size={20} className="text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">Members</h2>
          </div>

          {loadingMembers ? (
            <p className="text-gray-600">Loading members...</p>
          ) : members.length === 0 ? (
            <p className="text-gray-600">No members found</p>
          ) : (
            <div className="space-y-2 mb-6">
              {members.map((m) => {
                const isSelf = m.user_id === user?.id;
                const isUpdating = updatingMemberId === m.user_id;

                const onlyShopping =
                  Boolean((m as any).only_shopping) || Boolean((m as any).shopping_only);

                return (
                  <div
                    key={`${m.workspace_id}-${m.user_id}`}
                    className="py-3 px-3 bg-gray-50 rounded-lg space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{displayMemberName(m)}</p>
                        <p className="text-xs text-gray-600 capitalize">{m.role}</p>
                        {!isSelf && m.profile?.email ? (
                          <p className="text-xs text-gray-500">{m.profile.email}</p>
                        ) : null}
                      </div>

                      <div className="flex gap-2 text-xs text-gray-600 flex-wrap justify-end">
                        {m.can_set_priority_p0 ? (
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded">Priority</span>
                        ) : null}
                        {m.can_manage_dues ? (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">Dues</span>
                        ) : null}
                        {m.can_manage_members ? (
                          <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded">Members</span>
                        ) : null}
                        {onlyShopping ? (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                            Only shopping list
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {canManageMembers && !isSelf ? (
                      <div className="border-t border-gray-200 pt-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-800 mb-2">
                          <Shield size={16} />
                          Privileges
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={Boolean(m.can_set_priority_p0)}
                              disabled={isUpdating}
                              onChange={(e) =>
                                updateMember(m.user_id, { can_set_priority_p0: e.target.checked })
                              }
                              className="h-4 w-4"
                            />
                            Allow priority adjustments
                          </label>

                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={Boolean(m.can_manage_dues)}
                              disabled={isUpdating}
                              onChange={(e) =>
                                updateMember(m.user_id, { can_manage_dues: e.target.checked })
                              }
                              className="h-4 w-4"
                            />
                            Manage dues
                          </label>

                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={Boolean(m.can_manage_members)}
                              disabled={isUpdating}
                              onChange={(e) =>
                                updateMember(m.user_id, { can_manage_members: e.target.checked })
                              }
                              className="h-4 w-4"
                            />
                            Manage members
                          </label>

                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={Boolean((m as any).can_edit_others_tasks)}
                              disabled={isUpdating}
                              onChange={(e) =>
                                updateMember(
                                  m.user_id,
                                  { can_edit_others_tasks: e.target.checked } as any
                                )
                              }
                              className="h-4 w-4"
                            />
                            Edit others’ tasks
                          </label>

                          {/* UPDATED: Only shopping list toggle sets/revokes shopping rights explicitly */}
                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={onlyShopping}
                              disabled={isUpdating}
                              onChange={(e) => {
                                const checked = e.target.checked;

                                updateMember(
                                  m.user_id,
                                  {
                                    // keep both flags aligned
                                    only_shopping: checked,
                                    shopping_only: checked,

                                    // shopping rights: ON => allow write, OFF => remove
                                    can_add_shopping: checked,
                                    can_write_shopping: checked,
                                    can_check_shopping: false,

                                    // optional: match DB trigger immediately (avoid UI flicker)
                                    can_create_tasks: checked ? false : (m as any).can_create_tasks,
                                    can_assign_tasks: checked ? false : (m as any).can_assign_tasks,
                                    can_manage_dues: checked ? false : (m as any).can_manage_dues,
                                    can_manage_members: checked ? false : (m as any).can_manage_members,
                                    can_set_priority_p0: checked ? false : (m as any).can_set_priority_p0,
                                    can_edit_others_tasks: checked
                                      ? false
                                      : (m as any).can_edit_others_tasks,
                                  } as any
                                );
                              }}
                              className="h-4 w-4"
                            />
                            Only shopping list
                          </label>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {canManageMembers ? (
            <div className="border-t pt-5">
              <div className="flex items-center gap-2 mb-3">
                <UserPlus size={18} className="text-gray-700" />
                <h3 className="text-sm font-semibold text-gray-900">Add member</h3>
              </div>

              <form onSubmit={handleAddMember} className="space-y-3 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    autoComplete="email"
                  />
                  <p className="text-xs text-gray-500 mt-1">Only existing accounts can be added (email lookup).</p>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={allowPriorityAdjustments}
                    onChange={(e) => setAllowPriorityAdjustments(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Allow priority adjustments
                </label>

                <button
                  type="submit"
                  disabled={addingMember}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  <UserPlus size={18} />
                  {addingMember ? 'Adding...' : 'Add member'}
                </button>
              </form>
            </div>
          ) : (
            <p className="text-sm text-gray-500">You don’t have permission to manage members in this workspace.</p>
          )}
        </div>

        {/* Profile */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserIcon size={20} className="text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
          </div>

          {!profilesKeyCol ? (
            <p className="text-sm text-gray-600">
              Profiles table doesn’t match expected schema yet. (No user id column found.)
            </p>
          ) : loadingProfile ? (
            <p className="text-gray-600">Loading profile...</p>
          ) : (
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <p className="text-gray-900">{user?.email || 'Not available'}</p>
              </div>

              <button
                onClick={saveMyProfile}
                disabled={savingProfile}
                className="w-full sm:w-auto px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {savingProfile ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          )}
        </div>

        {/* Account */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account</h2>
          <button
            onClick={handleSignOut}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}