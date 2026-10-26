'use client';

import React, { useState } from 'react';
import { CheckCircle2, Circle, FolderKanban, Plus, Users } from 'lucide-react';
import { CircleProjectItem } from '@/types/domain';
import { Button } from '@/components/ui/button';

export function ProjectsBoard({
  circleId,
  initialProjects,
  isMember,
}: {
  circleId: string;
  initialProjects: CircleProjectItem[];
  isMember: boolean;
}) {
  const [projects, setProjects] = useState<CircleProjectItem[]>(initialProjects);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refreshProjects() {
    const res = await fetch(`/api/circles/${circleId}/resources?mode=projects`);
    if (res.ok) {
      const data = await res.json();
      setProjects(data.projects);
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_project',
          name,
          description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create project.');
      await refreshProjects();
      setName('');
      setDescription('');
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create project.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddTask(projectId: string) {
    const taskTitle = window.prompt('Enter new task title:');
    if (!taskTitle || taskTitle.trim().length < 2) return;
    try {
      const res = await fetch(`/api/circles/${circleId}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_task',
          projectId,
          title: taskTitle.trim(),
          priority: 'medium',
        }),
      });
      if (res.ok) {
        await refreshProjects();
      }
    } catch {
      // ignore
    }
  }

  async function handleToggleTask(taskId: string, currentStatus: string) {
    const nextStatus = currentStatus === 'done' ? 'todo' : 'done';
    try {
      const res = await fetch(`/api/circles/${circleId}/resources`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          status: nextStatus,
        }),
      });
      if (res.ok) {
        await refreshProjects();
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-stone-900">Projects & Workspaces</h2>
            <span className="rounded-full bg-forest-50 px-2 py-0.5 text-[10px] font-mono font-semibold text-forest-800 border border-forest-200/60">
              {projects.length} PROJECTS
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500 font-normal">
            Collaborative team milestones, tasks, and contributor rosters.
          </p>
        </div>
        {isMember && (
          <Button
            size="sm"
            variant={showCreate ? 'secondary' : 'primary'}
            onClick={() => setShowCreate((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{showCreate ? 'Cancel' : 'New Project'}</span>
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-xs font-medium text-red-800">
          {error}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={handleCreateProject}
          className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-premium space-y-4"
        >
          <div className="border-b border-stone-100 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800">
              Launch Collaborative Project
            </h3>
          </div>

          <div>
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
              Project Name *
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Distributed Consensus Benchmark Suite"
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
              Description & Objectives
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scope, repo links, and how members can contribute..."
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      )}

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-xs">
          <FolderKanban className="mx-auto h-8 w-8 text-stone-400" />
          <h3 className="mt-3 text-base font-bold text-stone-900">No Active Projects</h3>
          <p className="mt-1 text-xs text-stone-500">
            Start a project workspace to track milestones, tasks, and team members.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((proj) => (
            <div
              key={proj.id}
              className="group rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs hover:border-forest-600/40 hover:shadow-premium-hover transition-all duration-200 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="rounded-full bg-forest-50 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-forest-800 border border-forest-200/60">
                    {proj.status}
                  </span>
                  <h3 className="mt-2 text-base font-bold text-stone-900 group-hover:text-forest-800 transition-colors">
                    {proj.name}
                  </h3>
                  {proj.description && (
                    <p className="mt-1 text-xs sm:text-sm text-stone-600 leading-relaxed font-normal">
                      {proj.description}
                    </p>
                  )}
                </div>
                {isMember && (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => handleAddTask(proj.id)}
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Task</span>
                  </Button>
                )}
              </div>

              {/* Linear-Style Task Row List */}
              {(proj.tasks?.length ?? 0) > 0 && (
                <div className="space-y-2 border-t border-stone-100 pt-3">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400">
                    Milestone Tasks ({proj.tasks?.length})
                  </p>
                  <div className="space-y-1.5">
                    {proj.tasks?.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        disabled={!isMember}
                        onClick={() => handleToggleTask(t.id, t.status)}
                        className="flex w-full items-center justify-between rounded-xl border border-stone-200/80 bg-stone-50/50 px-3.5 py-2 text-left text-xs hover:border-black hover:bg-stone-50 transition-all"
                      >
                        <span
                          className={`inline-flex items-center gap-2 font-medium ${
                            t.status === 'done'
                              ? 'line-through text-stone-400'
                              : 'text-stone-800'
                          }`}
                        >
                          {t.status === 'done' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-black shrink-0" />
                          ) : (
                            <Circle className="h-3.5 w-3.5 text-stone-300 shrink-0" />
                          )}
                          <span>{t.title}</span>
                        </span>
                        <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-mono font-semibold uppercase text-stone-500 border border-stone-200/60">
                          {t.status}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 border-t border-stone-100 pt-3 text-xs text-stone-400">
                <span className="inline-flex items-center gap-1.5 font-medium text-stone-600">
                  <Users className="h-3.5 w-3.5 text-stone-900" />
                  {proj.members?.length ?? 1} contributors
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
