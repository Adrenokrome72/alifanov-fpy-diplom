import React from 'react';
import { render, screen } from '@testing-library/react';
import FileManager from '../components/FileManager';

// Мокаем redux hooks: useDispatch и useSelector
const mockFiles = [
  { id: 1, original_name: 'a.txt', size: 3, download_url: '/api/files/1/download/' },
  { id: 2, original_name: 'b.txt', size: 5, download_url: '/api/files/2/download/' },
];

jest.mock('react-redux', () => ({
  useDispatch: () => jest.fn(),
  useSelector: (fn) => fn({ files: { items: mockFiles } }),
}));

// Мокаем fetch в случае, если компонент вызывает fetch напрямую (он использует fetch in thunk normally).
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([]),
  })
);

test('FileManager renders list of files from store', async () => {
  render(<FileManager />);

  // Проверяем, что имена файлов отображаются
  expect(await screen.findByText('a.txt')).toBeInTheDocument();
  expect(await screen.findByText('b.txt')).toBeInTheDocument();
});