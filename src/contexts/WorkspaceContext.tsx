//src/contexts/WorkspaceContext.tsx

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { Database } from '../lib/types';

type Workspace =
  Database['public']['Tables']['workspaces']['Row'];

type WorkspaceMember =
  Database['public']['Tables']['workspace_members']['Row'];

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeWorkspace: Workspace | null;
  membership: WorkspaceMember | null;
  loading: boolean;
  isOnlyShopping: boolean;

  setActiveWorkspaceId: (id: string) => void;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (
    name: string,
  ) => Promise<string | null>;
}

const WorkspaceContext =
  createContext<WorkspaceContextType | undefined>(
    undefined,
  );

function normalizeWorkspaceId(data: any): string | null {
  if (typeof data === 'string') {
    return data;
  }

  if (Array.isArray(data)) {
    const first = data[0];

    if (!first) return null;
    if (typeof first === 'string') return first;

    return first.workspace_id || first.id || null;
  }

  if (data && typeof data === 'object') {
    return data.workspace_id || data.id || null;
  }

  return null;
}

export function WorkspaceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  const userId = user?.id ?? null;

  const [workspaces, setWorkspaces] = useState<
    Workspace[]
  >([]);

  const [
    activeWorkspaceId,
    setActiveWorkspaceIdState,
  ] = useState<string | null>(() => {
    return localStorage.getItem('active_workspace_id');
  });

  const [membership, setMembership] =
    useState<WorkspaceMember | null>(null);

  const [loading, setLoading] = useState(true);

  const isOnlyShopping = Boolean(
    (membership as any)?.only_shopping,
  );

  const fetchInFlight = useRef(false);

  const setActiveWorkspaceId = useCallback(
    (id: string) => {
      setActiveWorkspaceIdState(id);
      localStorage.setItem(
        'active_workspace_id',
        id,
      );
    },
    [],
  );

  const fetchWorkspaces = useCallback(async () => {
    if (!userId) {
      setWorkspaces([]);
      setActiveWorkspaceIdState(null);
      setMembership(null);
      setLoading(false);
      return;
    }

    if (fetchInFlight.current) return;

    fetchInFlight.current = true;
    setLoading(true);

    const safety = window.setTimeout(() => {
      fetchInFlight.current = false;
      setLoading(false);
    }, 8000);

    try {
      /*
       * 1. Discover workspaces through membership.
       */
      const {
        data: memberRows,
        error: memberError,
      } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId);

      if (memberError) {
        console.warn(
          'Workspace membership lookup failed:',
          memberError,
        );
      }

      const membershipIds = (
        memberRows || []
      )
        .map((row: any) => row.workspace_id)
        .filter(Boolean);

      /*
       * 2. Also discover workspaces created by this user.
       *
       * This is an important fallback. A temporary membership
       * lookup failure must never make an existing workspace
       * disappear from the UI.
       */
      const {
        data: ownedRows,
        error: ownedError,
      } = await supabase
        .from('workspaces')
        .select(
          'id,name,created_at,created_by',
        )
        .eq('created_by', userId);

      if (ownedError) {
        console.warn(
          'Owned workspace lookup failed:',
          ownedError,
        );
      }

      const ownedIds = (ownedRows || [])
        .map((row: any) => row.id)
        .filter(Boolean);

      const workspaceIds = Array.from(
        new Set([
          ...membershipIds,
          ...ownedIds,
        ]),
      );

      /*
       * Do NOT immediately destroy the remembered workspace
       * merely because one lookup returned nothing.
       */
      if (workspaceIds.length === 0) {
        console.warn(
          'No workspace rows resolved for current user.',
        );

        setWorkspaces([]);

        /*
         * Preserve active_workspace_id here.
         * ProtectedRoute can wait/retry instead of throwing
         * the user into onboarding.
         */
        return;
      }

      /*
       * 3. Load full workspace rows.
       */
      const {
        data: workspaceRows,
        error: workspaceError,
      } = await supabase
        .from('workspaces')
        .select(
          'id,name,created_at,created_by',
        )
        .in('id', workspaceIds)
        .order('created_at', {
          ascending: true,
        });

      if (workspaceError) {
        throw workspaceError;
      }

      const list =
        (workspaceRows || []) as Workspace[];

      setWorkspaces(list);

      /*
       * 4. Resolve active workspace.
       */
      const saved = localStorage.getItem(
        'active_workspace_id',
      );

      let nextActive: string | null = null;

      if (
        saved &&
        list.some(
          (workspace) =>
            workspace.id === saved,
        )
      ) {
        nextActive = saved;
      } else if (list.length > 0) {
        nextActive = list[0].id;
      }

      if (nextActive) {
        localStorage.setItem(
          'active_workspace_id',
          nextActive,
        );
      }

      setActiveWorkspaceIdState(nextActive);
    } catch (error) {
      console.error(
        'Error fetching workspaces:',
        error,
      );
    } finally {
      window.clearTimeout(safety);
      fetchInFlight.current = false;
      setLoading(false);
    }
  }, [userId]);

  const fetchMembership = useCallback(
    async () => {
      if (!userId || !activeWorkspaceId) {
        setMembership(null);
        return;
      }

      try {
        const {
          data,
          error,
        } = await supabase
          .from('workspace_members')
          .select('*')
          .eq(
            'workspace_id',
            activeWorkspaceId,
          )
          .eq('user_id', userId)
          .maybeSingle();

        if (error) throw error;

        setMembership(data);
      } catch (error) {
        console.error(
          'Error fetching membership:',
          error,
        );

        setMembership(null);
      }
    },
    [userId, activeWorkspaceId],
  );

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  useEffect(() => {
    fetchMembership();
  }, [fetchMembership]);

  const createWorkspace = useCallback(
    async (
      name: string,
    ): Promise<string | null> => {
      if (!userId) return null;

      const cleanName =
        name.trim() || 'My Workspace';

      try {
        const {
          data,
          error,
        } = await supabase.rpc(
          'create_workspace',
          {
            p_name: cleanName,
          },
        );

        if (error) throw error;

        const workspaceId =
          normalizeWorkspaceId(data);

        if (!workspaceId) {
          throw new Error(
            'Workspace created but no workspace_id returned',
          );
        }

        setActiveWorkspaceId(workspaceId);

        setMembership({
          workspace_id: workspaceId,
          user_id: userId,
          role: 'admin',
          can_manage_members: true,
          can_manage_dues: true,
          can_set_priority_p0: true,

          // @ts-ignore optional column
          can_edit_others_tasks: true,

          // @ts-ignore optional column
          only_shopping: false,

          created_at:
            new Date().toISOString(),

          updated_at:
            new Date().toISOString(),
        } as any);

        setWorkspaces((previous) => {
          if (
            previous.some(
              (workspace) =>
                workspace.id === workspaceId,
            )
          ) {
            return previous;
          }

          const optimisticWorkspace: Workspace =
            {
              id: workspaceId,
              name: cleanName,
              created_by: userId,
              created_at:
                new Date().toISOString(),
            } as any;

          return [
            ...previous,
            optimisticWorkspace,
          ];
        });

        fetchWorkspaces();
        fetchMembership();

        return workspaceId;
      } catch (error) {
        console.error(
          'Error creating workspace:',
          error,
        );

        return null;
      }
    },
    [
      userId,
      setActiveWorkspaceId,
      fetchWorkspaces,
      fetchMembership,
    ],
  );

  const activeWorkspace =
    workspaces.find(
      (workspace) =>
        workspace.id === activeWorkspaceId,
    ) || null;

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspaceId,
        activeWorkspace,
        membership,
        loading,
        isOnlyShopping,
        setActiveWorkspaceId,
        refreshWorkspaces:
          fetchWorkspaces,
        createWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context =
    useContext(WorkspaceContext);

  if (context === undefined) {
    throw new Error(
      'useWorkspace must be used within a WorkspaceProvider',
    );
  }

  return context;
}