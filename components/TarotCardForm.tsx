'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface TarotCardFormData {
  name: string;
  number: string;
  suit: string;
  meaning: string;
  upright: string[];
  reversed: string[];
  description: string;
}

interface TarotCardFormProps {
  onSubmit: (data: TarotCardFormData) => void;
  onCancel: () => void;
}

export default function TarotCardForm({ onSubmit, onCancel }: TarotCardFormProps) {
  const [formData, setFormData] = useState<TarotCardFormData>({
    name: '',
    number: '',
    suit: '',
    meaning: '',
    upright: [],
    reversed: [],
    description: '',
  });

  const [uprightInput, setUprightInput] = useState('');
  const [reversedInput, setReversedInput] = useState('');

  const handleAddUpright = () => {
    if (uprightInput.trim()) {
      setFormData({
        ...formData,
        upright: [...formData.upright, uprightInput.trim()],
      });
      setUprightInput('');
    }
  };

  const handleAddReversed = () => {
    if (reversedInput.trim()) {
      setFormData({
        ...formData,
        reversed: [...formData.reversed, reversedInput.trim()],
      });
      setReversedInput('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <div>
        <label className="block text-white mb-2">Tên lá bài *</label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500"
          placeholder="The Fool"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-white mb-2">Số thứ tự</label>
          <input
            type="text"
            value={formData.number}
            onChange={(e) => setFormData({ ...formData, number: e.target.value })}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500"
            placeholder="0, I, II, etc."
          />
        </div>
        <div>
          <label className="block text-white mb-2">Bộ (Suit)</label>
          <input
            type="text"
            value={formData.suit}
            onChange={(e) => setFormData({ ...formData, suit: e.target.value })}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500"
            placeholder="Major Arcana, Cups, etc."
          />
        </div>
      </div>

      <div>
        <label className="block text-white mb-2">Ý nghĩa *</label>
        <input
          type="text"
          required
          value={formData.meaning}
          onChange={(e) => setFormData({ ...formData, meaning: e.target.value })}
          className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500"
          placeholder="New Beginnings, Innocence, Spontaneity"
        />
      </div>

      <div>
        <label className="block text-white mb-2">Mô tả *</label>
        <textarea
          required
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={4}
          className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500 resize-none"
          placeholder="Mô tả chi tiết về lá bài..."
        />
      </div>

      <div>
        <label className="block text-white mb-2">Upright (Ngửa)</label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={uprightInput}
            onChange={(e) => setUprightInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddUpright())}
            className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-green-500"
            placeholder="Thêm ý nghĩa upright..."
          />
          <button
            type="button"
            onClick={handleAddUpright}
            className="px-4 py-3 rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30"
          >
            +
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.upright.map((item, i) => (
            <span
              key={i}
              className="px-3 py-1 rounded-full bg-green-500/20 text-green-300 text-sm flex items-center gap-2"
            >
              {item}
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    upright: formData.upright.filter((_, idx) => idx !== i),
                  })
                }
                className="hover:text-red-400"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-white mb-2">Reversed (Ngược)</label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={reversedInput}
            onChange={(e) => setReversedInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddReversed())}
            className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-red-500"
            placeholder="Thêm ý nghĩa reversed..."
          />
          <button
            type="button"
            onClick={handleAddReversed}
            className="px-4 py-3 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30"
          >
            +
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.reversed.map((item, i) => (
            <span
              key={i}
              className="px-3 py-1 rounded-full bg-red-500/20 text-red-300 text-sm flex items-center gap-2"
            >
              {item}
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    reversed: formData.reversed.filter((_, idx) => idx !== i),
                  })
                }
                className="hover:text-red-400"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <motion.button
          type="submit"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex-1 px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold"
        >
          Lưu
        </motion.button>
        <motion.button
          type="button"
          onClick={onCancel}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="px-6 py-3 rounded-full glass text-white font-semibold"
        >
          Hủy
        </motion.button>
      </div>
    </motion.form>
  );
}

