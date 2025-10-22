import { render, screen, fireEvent } from '@testing-library/react';
import Home from '../page';

// Mock the fileParser module since we're testing UI, not file parsing logic
jest.mock('@/lib/fileParser', () => ({
  extractTextFromFile: jest.fn(),
  validateFile: jest.fn(() => ({ valid: true })),
}));

describe('Home Page - Toggle Buttons', () => {
  it('should render both toggle buttons', () => {
    render(<Home />);
    
    expect(screen.getByText('Upload File')).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
  });

  it('should default to text mode (text button active)', () => {
    render(<Home />);
    
    const fileButton = screen.getByText('Upload File');
    const textButton = screen.getByText('Text');
    
    // Text button should have active styling (bg-blue-600)
    expect(textButton).toHaveClass('bg-blue-600');
    // File button should have inactive styling (bg-gray-700)
    expect(fileButton).toHaveClass('bg-gray-700');
  });

  it('should show textarea in text mode by default', () => {
    render(<Home />);
    
    // Should see the textarea
    expect(screen.getByPlaceholderText('Paste your notes here...')).toBeInTheDocument();
  });

  it('should switch to file mode when Upload File button is clicked', () => {
    render(<Home />);
    
    const fileButton = screen.getByText('Upload File');
    
    // Click the file button
    fireEvent.click(fileButton);
    
    // File button should now be active
    expect(fileButton).toHaveClass('bg-blue-600');
    
    // Should see the file upload area
    expect(screen.getByText(/Click to browse files/)).toBeInTheDocument();
  });

  it('should switch back to text mode when Text button is clicked', () => {
    render(<Home />);
    
    const fileButton = screen.getByText('Upload File');
    const textButton = screen.getByText('Text');
    
    // First switch to file mode
    fireEvent.click(fileButton);
    expect(screen.getByText(/Click to browse files/)).toBeInTheDocument();
    
    // Then switch back to text mode
    fireEvent.click(textButton);
    expect(textButton).toHaveClass('bg-blue-600');
    expect(screen.getByPlaceholderText('Paste your notes here...')).toBeInTheDocument();
  });

  it('should hide file upload area when in text mode', () => {
    render(<Home />);
    
    const fileButton = screen.getByText('Upload File');
    
    // Switch to file mode first
    fireEvent.click(fileButton);
    expect(screen.getByText(/Click to browse files/)).toBeInTheDocument();
    
    // Switch back to text mode
    const textButton = screen.getByText('Text');
    fireEvent.click(textButton);
    
    // File upload area should not be visible
    expect(screen.queryByText(/Click to browse files/)).not.toBeInTheDocument();
  });

  it('should hide textarea when in file mode', () => {
    render(<Home />);
    
    // Default is text mode, textarea visible
    expect(screen.getByPlaceholderText('Paste your notes here...')).toBeInTheDocument();
    
    // Switch to file mode
    const fileButton = screen.getByText('Upload File');
    fireEvent.click(fileButton);
    
    // Textarea should not be visible
    expect(screen.queryByPlaceholderText('Paste your notes here...')).not.toBeInTheDocument();
  });
});

describe('Home Page - Generate Button', () => {
  it('should render the Generate Questions button', () => {
    render(<Home />);
    
    expect(screen.getByText('Generate Questions')).toBeInTheDocument();
  });

  it('should show app title', () => {
    render(<Home />);
    
    expect(screen.getByText('AI Study Buddy')).toBeInTheDocument();
  });
});

