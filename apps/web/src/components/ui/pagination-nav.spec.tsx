import { render, screen } from '@testing-library/react';
import { PaginationNav, type PaginationNavProps } from './pagination-nav';

function renderNav(props: Partial<PaginationNavProps> = {}) {
  render(
    <PaginationNav
      page={2}
      lastPage={3}
      hrefFor={(page) => `/lista?page=${page}`}
      label="Paginação"
      previousLabel="Anterior"
      nextLabel="Próxima"
      summary="Página 2 de 3"
      {...props}
    />,
  );
}

describe('PaginationNav', () => {
  it('mostra links para a página anterior e a próxima no meio da lista', () => {
    renderNav();

    expect(
      screen.getByRole('navigation', { name: 'Paginação' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Anterior' })).toHaveAttribute(
      'href',
      '/lista?page=1',
    );
    expect(screen.getByRole('link', { name: 'Próxima' })).toHaveAttribute(
      'href',
      '/lista?page=3',
    );
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();
  });

  it('desabilita "Anterior" na primeira página', () => {
    renderNav({ page: 1 });

    expect(
      screen.queryByRole('link', { name: 'Anterior' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Anterior')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('desabilita "Próxima" na última página', () => {
    renderNav({ page: 3 });

    expect(
      screen.queryByRole('link', { name: 'Próxima' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Próxima')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
