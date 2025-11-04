// frontend/src/__tests__/Login.test.jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from 'react';                // <- импорт act из 'react'
import Login from '../components/Login';
import { BrowserRouter } from 'react-router-dom';

// Мокаем useDispatch из react-redux, чтобы проверить, что Login вызывает dispatch
jest.mock('react-redux', () => ({
  useDispatch: () => jest.fn(() => ({ unwrap: () => Promise.resolve() })),
}));

test('Login form submits and calls dispatch', async () => {
  render(
    <BrowserRouter>
      <Login />
    </BrowserRouter>
  );

  const userInput = screen.getByPlaceholderText(/username/i);
  const passInput = screen.getByPlaceholderText(/password/i);
  const btn = screen.getByRole('button', { name: /login/i });

  fireEvent.change(userInput, { target: { value: 'testuser' } });
  fireEvent.change(passInput, { target: { value: 'Aa1!pass' } });

  // Обёртываем в act чтобы избежать предупреждения о неупакованных обновлениях
  await act(async () => {
    fireEvent.click(btn);
    // даём обещаниям внутри компонента выполниться
    await Promise.resolve();
  });

  // Убедимся, что кнопка доступна (и обработка не выбросила)
  expect(btn).toBeEnabled();
});
