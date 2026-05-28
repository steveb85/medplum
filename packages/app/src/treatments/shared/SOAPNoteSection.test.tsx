import { render, screen } from '../../test-utils/render';
import { SOAPNoteSection, DEFAULT_SOAP_NOTE } from './SOAPNoteSection';

describe('SOAPNoteSection', () => {
  test('should render SOAP note sections', () => {
    render(
      <SOAPNoteSection
        value={DEFAULT_SOAP_NOTE}
        onChange={() => {}}
      />
    );
    expect(screen.getByText('SOAP Note')).toBeInTheDocument();
    expect(screen.getByText('Subjective')).toBeInTheDocument();
    expect(screen.getByText('Objective')).toBeInTheDocument();
    expect(screen.getByText('Review of Systems')).toBeInTheDocument();
    expect(screen.getByText('Assessment')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
  });

  test('should render ROS checklist items', () => {
    render(
      <SOAPNoteSection
        value={DEFAULT_SOAP_NOTE}
        onChange={() => {}}
      />
    );
    expect(screen.getByText('None of the above (all systems negative)')).toBeInTheDocument();
    expect(screen.getByText('Rash')).toBeInTheDocument();
    expect(screen.getByText('Fever')).toBeInTheDocument();
    expect(screen.getByText('Cough')).toBeInTheDocument();
  });
});
