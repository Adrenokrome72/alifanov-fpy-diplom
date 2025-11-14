import React from 'react';

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
