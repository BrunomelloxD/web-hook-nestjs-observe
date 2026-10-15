import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PaginationNav } from './pagination-nav';

const meta = {
  title: 'UI/PaginationNav',
  component: PaginationNav,
  args: {
    page: 2,
    lastPage: 3,
    hrefFor: (page: number) => `?page=${page}`,
    label: 'Paginação',
    previousLabel: 'Anterior',
    nextLabel: 'Próxima',
    summary: 'Página 2 de 3',
  },
} satisfies Meta<typeof PaginationNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MiddlePage: Story = {};
export const FirstPage: Story = { args: { page: 1, summary: 'Página 1 de 3' } };
export const LastPage: Story = { args: { page: 3, summary: 'Página 3 de 3' } };
export const SinglePage: Story = {
  args: { page: 1, lastPage: 1, summary: 'Página 1 de 1' },
};
