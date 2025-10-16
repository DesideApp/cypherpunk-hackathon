/// <reference types="vite/client" />

declare module '*.svg?react' {
  import * as React from 'react';
  export const ReactComponent: React.FC<React.SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}
