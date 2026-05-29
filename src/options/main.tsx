import '@fontsource/nunito/400.css'
import '@fontsource/nunito/500.css'
import '@fontsource/nunito/600.css'
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/800.css'
import '@/styles/tokens.css'
import './options.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Options } from './Options'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Options />
  </StrictMode>,
)
