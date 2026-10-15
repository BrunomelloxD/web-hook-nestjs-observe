import { render, screen, within } from '@testing-library/react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from './table';

describe('Table', () => {
  it('monta a tabela com todas as partes', () => {
    render(
      <Table className="t">
        <TableCaption>Legenda</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Coluna</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Valor</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    );

    const table = screen.getByRole('table', { name: 'Legenda' });
    expect(table).toHaveClass('t');
    expect(
      within(table).getByRole('columnheader', { name: 'Coluna' }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole('cell', { name: 'Valor' }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole('cell', { name: 'Total' }),
    ).toBeInTheDocument();
  });
});
