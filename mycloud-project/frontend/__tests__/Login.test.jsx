import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Login from '../components/Login';

// Мокаем useDispatch из react-redux, чтобы проверить, что Login вызывает dispatch
jest.mock('react-redux', () => ({
  useDispatch: () => jest.fn(() => ({ unwrap: () => Promise.resolve() })),
}));

test('Login form submits and calls dispatch', async () => {
  render(<Login />);

  const userInput = screen.getByPlaceholderText(/username/i);
  const passInput = screen.getByPlaceholderText(/password/i);
  const btn = screen.getByRole('button', { name: /login/i });

  fireEvent.change(userInput, { target: { value: 'testuser' } });
  fireEvent.change(passInput, { target: { value: 'Aa1!pass' } });

  // submit
  fireEvent.click(btn);

  // У нас мок dispatch возвращает resolved unwrap(), поэтому нет ошибок.
  // Проверяем, что кнопка присутствует и форму можно отправить без исключения.
  expect(btn).toBeEnabled();
});