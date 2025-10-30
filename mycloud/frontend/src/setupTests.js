import React from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from '../store';
import CloudExplorer from '../components/CloudExplorer';

test('renders CloudExplorer', () => {
  const { getByText } = render(
    <Provider store={store}>
      <CloudExplorer />
    </Provider>
  );
  expect(getByText(/Папки/i)).toBeInTheDocument();
});