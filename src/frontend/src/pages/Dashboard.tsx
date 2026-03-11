import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSparkStore } from '../store';
import './Dashboard.css';

const STATS = [
  { label: 'Published Looks', value: '18', hint: 'Land content packs this week' },
  { label: 'Engagement Lift', value: '+34%', hint: 'Against last editorial batch' },
  { label: 'Try-On Signals', value: '52', hint: 'Intent-rich feedback events' },
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    projects,
    loadingProjects,
    busy,
    error,
    loadProjects,
    createProjectAndOpen,
    renameProject,
  } = useSparkStore();

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const openProject = async () => {
    const project = await createProjectAndOpen('Untitled Project');
    navigate(`/canvas/${project.id}`);
  };

  const handleRename = async (projectId: string, currentName: string) => {
    const nextName = window.prompt('请输入新的方案名称', currentName);
    if (nextName === null) return;

    const trimmedName = nextName.trim();
    if (!trimmedName || trimmedName === currentName) return;

    try {
      await renameProject(projectId, trimmedName);
    } catch {
      // 错误由全局 store 状态展示
    }
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-shell">
        <header className="dashboard-topbar">
          <div className="dashboard-branding">
            <span className="dashboard-brand-mark">MUSE</span>
            <p className="dashboard-brand-copy">
              Spark orchestration workspace for styling, generation, and publish review.
            </p>
          </div>
          <button className="dashboard-create-button" type="button" onClick={() => void openProject()} disabled={busy}>
            + 新建设计方案
          </button>
        </header>

        <section className="dashboard-stats" aria-label="Spark stats overview">
          {STATS.map((stat) => (
            <article key={stat.label} className="dashboard-stat-card">
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <p>{stat.hint}</p>
            </article>
          ))}
        </section>

        <section className="dashboard-projects">
          <div className="dashboard-section-heading">
            <div>
              <span className="dashboard-eyebrow">Workspace archive</span>
              <h2>Design projects</h2>
            </div>
            {error ? <p className="dashboard-error">{error}</p> : null}
          </div>

          {loadingProjects ? (
            <div className="dashboard-grid dashboard-grid-loading">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="dashboard-skeleton" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="dashboard-empty">
              <h3>No Spark projects yet</h3>
              <p>Create your first board to start curating assets and AI looks.</p>
            </div>
          ) : (
            <div className="dashboard-grid">
              {projects.map((project) => (
                <article key={project.id} className="project-card">
                  <button
                    type="button"
                    className="project-card-cover"
                    onClick={() => navigate(`/canvas/${project.id}`)}
                  >
                    {project.cover_url ? (
                      <img src={project.cover_url} alt={project.name} />
                    ) : (
                      <div className="project-card-placeholder">
                        <span>Canvas ready</span>
                      </div>
                    )}
                  </button>
                  <div className="project-card-body">
                    <div>
                      <h3>{project.name}</h3>
                      <p>{formatDate(project.updated_at)}</p>
                    </div>
                    <div className="project-card-meta">
                      <span>{project.asset_count} assets</span>
                      <span>{project.look_count} looks</span>
                    </div>
                  </div>
                  <div className="project-card-actions">
                    <button
                      type="button"
                      onClick={() => {
                        void handleRename(project.id, project.name);
                      }}
                      disabled={busy}
                    >
                      重命名
                    </button>
                    <button type="button" disabled title="当前后端未提供复制接口">
                      复制
                    </button>
                    <button type="button" disabled title="当前前端未接入删除流程">
                      删除
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
