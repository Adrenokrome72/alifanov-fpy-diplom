import React from 'react';
import { render, screen } from '@testing-library/react';
import NavBar from '../components/NavBar';
import { BrowserRouter } from 'react-router-dom';

test('NavBar renders links', () => {
  render(
    <BrowserRouter>
      <NavBar />
    </BrowserRouter>
  );

  expect(screen.getByText(/My Cloud/i)).toBeInTheDocument();
  expect(screen.getByText(/Files/i)).toBeInTheDocument();
  expect(screen.getByText(/Admin/i)).toBeInTheDocument();
  expect(screen.getByText(/Login/i)).toBeInTheDocument();
  expect(screen.getByText(/Register/i)).toBeInTheDocument();
});