import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['__tests__/setup.ts'],
        include: ['__tests__/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.ts'],
            exclude: ['**/*.d.ts', '**/*.test.ts', '**/examples.ts', '**/template.ts']
        }
    }
});
