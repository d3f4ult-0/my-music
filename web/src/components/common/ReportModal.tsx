import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Song } from '../../types';
import { apiRequest } from '../../api/client';

interface ReportModalProps {
  song: Song | null;
  onClose: () => void;
}

const REASONS = [
  { value: 'COPYRIGHT', label: 'Copyright or ownership infringement' },
  { value: 'INAPPROPRIATE', label: 'Inappropriate or harmful content' },
  { value: 'SPAM', label: 'Spam or misleading audio' },
  { value: 'INCORRECT_METADATA', label: 'Incorrect metadata, title, or tags' },
  { value: 'OTHER', label: 'Other issue' },
];

export const ReportModal: React.FC<ReportModalProps> = ({ song, onClose }) => {
  const [reason, setReason] = useState('COPYRIGHT');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!song) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiRequest('/reports', {
        method: 'POST',
        body: JSON.stringify({
          song_id: song.id,
          reason,
          description: description.trim() || undefined,
        }),
      });
      setIsSuccess(true);
      setTimeout(() => onClose(), 1200);
    } catch (err: any) {
      alert(`Could not submit report: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border-subtle rounded-xl max-w-md w-full p-5 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-400" />
            <h3 className="font-semibold text-neutral-100 text-base">Report Track</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-surface-hover transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-8 text-center text-sm text-primary font-medium">
            Thank you. Your report has been submitted for moderation review.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="text-xs text-neutral-400 mb-2">
                Reporting: <span className="text-white font-medium">{song.title}</span> by{' '}
                <span className="text-white">{song.artist?.name}</span>
              </p>
              <label className="block text-xs uppercase font-medium text-neutral-400 mb-1.5">
                Reason for report
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-surface-card border border-border-subtle rounded-lg text-white focus:outline-none focus:border-primary"
              >
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase font-medium text-neutral-400 mb-1.5">
                Additional Details (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Explain the issue..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-surface-card border border-border-subtle rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-primary resize-none"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-lg transition-colors"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
