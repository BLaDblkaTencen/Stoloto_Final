import '@fontsource/comfortaa/600.css';
import '@fontsource/comfortaa/700.css';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/600.css';
import '@fontsource/rubik/700.css';
import '@fontsource/unbounded/700.css';
import './index.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { z } from 'zod';
import { router } from './app/router';
import { queryClient } from './shared/api/queryClient';

// Стандартные ошибки Zod по-русски — для форм, где в схеме не задан свой текст.
z.config(z.locales.ru());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
