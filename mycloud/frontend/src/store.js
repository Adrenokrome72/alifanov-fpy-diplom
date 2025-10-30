import { createStore } from 'redux';

const initialState = {
  user: null,
  files: [],
  folders: [],
  storage: { used: 0, limit: 100 * 1024 * 1024 },
};

function reducer(state = initialState, action) {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_FILES':
      return { ...state, files: action.payload };
    case 'SET_FOLDERS':
      return { ...state, folders: action.payload };
    case 'SET_STORAGE':
      return { ...state, storage: action.payload };
    default:
      return state;
  }
}

export const store = createStore(reducer);