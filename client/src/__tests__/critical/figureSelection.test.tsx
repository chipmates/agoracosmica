import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDomainStore } from '../../stores/domainStore';
import type { Figure } from '../../types/global';

describe('Figure Selection - Critical Path', () => {
  beforeEach(() => {
    // Reset store before each test
    useDomainStore.setState({
      figures: {
        list: [],
        selectedId: null,
        isLoading: false,
        error: null,
        lastFetchedAt: null
      }
    });
  });

  it('should select a figure by ID', () => {
    const { result } = renderHook(() => useDomainStore());

    act(() => {
      result.current.selectFigure('einstein');
    });

    expect(result.current.figures.selectedId).toBe('einstein');
  });

  it('should load figures without errors', () => {
    const { result } = renderHook(() => useDomainStore());
    const testFigures: Figure[] = [
      {
        id: 'einstein',
        name: 'Albert Einstein'
      }
    ];

    act(() => {
      result.current.setFigures(testFigures);
    });

    expect(result.current.figures.list).toHaveLength(1);
    expect(result.current.figures.list[0].id).toBe('einstein');
    expect(result.current.figures.error).toBeNull();
  });

  it('should clear selected figure', () => {
    const { result } = renderHook(() => useDomainStore());

    act(() => {
      result.current.selectFigure('einstein');
    });
    expect(result.current.figures.selectedId).toBe('einstein');

    act(() => {
      result.current.selectFigure(null);
    });
    expect(result.current.figures.selectedId).toBeNull();
  });

  it('should set loading state', () => {
    const { result } = renderHook(() => useDomainStore());

    act(() => {
      result.current.setFigureLoading(true);
    });
    expect(result.current.figures.isLoading).toBe(true);

    act(() => {
      result.current.setFigureLoading(false);
    });
    expect(result.current.figures.isLoading).toBe(false);
  });

  it('should set error state', () => {
    const { result } = renderHook(() => useDomainStore());
    const errorMessage = 'Failed to load figures';

    act(() => {
      result.current.setFigureError(errorMessage);
    });

    expect(result.current.figures.error).toBe(errorMessage);
  });
});
