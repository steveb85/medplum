import { render, screen } from '../../test-utils/render';
import { ProcedureNoteSection, DEFAULT_PROCEDURE_NOTE } from './ProcedureNoteSection';

describe('ProcedureNoteSection', () => {
  test('should render procedure note sections', () => {
    render(
      <ProcedureNoteSection
        value={DEFAULT_PROCEDURE_NOTE}
        onChange={() => {}}
      />
    );
    expect(screen.getByText('Procedure Note')).toBeInTheDocument();
    expect(screen.getByText('Pre-Op Diagnosis')).toBeInTheDocument();
    expect(screen.getByText('Post-Op Diagnosis')).toBeInTheDocument();
    expect(screen.getByText('Procedure Performed')).toBeInTheDocument();
    expect(screen.getByText('Findings')).toBeInTheDocument();
    expect(screen.getByText('Complications')).toBeInTheDocument();
    expect(screen.getByText('Level of Monitoring')).toBeInTheDocument();
    expect(screen.getByText('Signed By')).toBeInTheDocument();
    expect(screen.getByText('Supervising Provider')).toBeInTheDocument();
  });

  test('should render CMS standard badge', () => {
    render(
      <ProcedureNoteSection
        value={DEFAULT_PROCEDURE_NOTE}
        onChange={() => {}}
      />
    );
    expect(screen.getByText(/CMS 11-line-item/)).toBeInTheDocument();
  });
});
