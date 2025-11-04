// frontend/src/components/Breadcrumbs.jsx
import React from 'react';

/**
 * Props:
 *  - breadcrumbs: [{id, name}, ...] - ordered from root->leaf (or leaf order as passed)
 *  - onCrumbClick: (id|null) => void
 *  - rootLabel: string (default "Root")
 */
export default function Breadcrumbs({ breadcrumbs = [], onCrumbClick = () => {}, rootLabel = "Root" }) {
  return (
    <div className="text-sm text-gray-600">
      <nav className="flex items-center gap-2">
        <button onClick={() => onCrumbClick(null)} className="hover:underline">{rootLabel}</button>
        {breadcrumbs.map((b, idx) => (
          <span key={b.id} className="flex items-center gap-2">
            <span>/</span>
            <button onClick={() => onCrumbClick(b.id)} className="hover:underline">{b.name}</button>
          </span>
        ))}
      </nav>
    </div>
  );
}
