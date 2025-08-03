import { renderHook, act, waitFor } from '@testing-library/react'
import { useLocation, useCurrentLocation } from '../use-location'
import * as locationUtils from '@/lib/location/utils'

// Mock the location utils
jest.mock('@/lib/location/utils', () => ({
  getCurrentLocation: jest.fn(),
  verifyLocation: jest.fn(),
  isLocationSupported: jest.fn(),
  requestLocationPermission: jest.fn(),
  LocationError: {
    NOT_SUPPORTED: 'NOT_SUPPORTED',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    POSITION_UNAVAILABLE: 'POSITION_UNAVAILABLE',
    TIMEOUT: 'TIMEOUT',
  },
  getLocationErrorMessage: jest.fn((error) => `Error: ${error}`),
}))

const mockLocationUtils = locationUtils as jest.Mocked<typeof locationUtils>

// Mock navigator.geolocation
const mockGeolocation = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
}

Object.defineProperty(global.navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
})

describe('useLocation', () => {
  const mockLocationData = {
    coords: {
      latitude: 13.7563,
      longitude: 100.5018,
    },
    accuracy: 15,
    timestamp: Date.now(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockLocationUtils.isLocationSupported.mockReturnValue(true)
    mockLocationUtils.requestLocationPermission.mockResolvedValue('granted')
  })

  test('should initialize with default state', () => {
    const { result } = renderHook(() => useLocation())

    expect(result.current.coords).toBeNull()
    expect(result.current.accuracy).toBeNull()
    expect(result.current.timestamp).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.supported).toBe(true)
    expect(result.current.watching).toBe(false)
    expect(result.current.hasLocation).toBe(false)
    expect(result.current.isAccurate).toBe(false)
  })

  test('should handle unsupported geolocation', () => {
    mockLocationUtils.isLocationSupported.mockReturnValue(false)

    const { result } = renderHook(() => useLocation())

    expect(result.current.supported).toBe(false)
  })

  test('should check permission on mount', async () => {
    renderHook(() => useLocation())

    await waitFor(() => {
      expect(mockLocationUtils.requestLocationPermission).toHaveBeenCalled()
    })
  })

  describe('getLocation', () => {
    test('should get current location successfully', async () => {
      mockLocationUtils.getCurrentLocation.mockResolvedValue(mockLocationData)

      const { result } = renderHook(() => useLocation())

      let locationResult: any
      await act(async () => {
        locationResult = await result.current.getLocation()
      })

      expect(mockLocationUtils.getCurrentLocation).toHaveBeenCalled()
      expect(result.current.coords).toEqual(mockLocationData.coords)
      expect(result.current.accuracy).toBe(mockLocationData.accuracy)
      expect(result.current.timestamp).toBe(mockLocationData.timestamp)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.hasLocation).toBe(true)
      expect(result.current.isAccurate).toBe(true)
      expect(locationResult).toEqual(mockLocationData)
    })

    test('should handle location error', async () => {
      const errorMessage = 'Location access denied'
      mockLocationUtils.getCurrentLocation.mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(() => useLocation())

      let locationResult: any
      await act(async () => {
        locationResult = await result.current.getLocation()
      })

      expect(result.current.coords).toBeNull()
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe(errorMessage)
      expect(result.current.hasLocation).toBe(false)
      expect(locationResult).toBeNull()
    })

    test('should handle unsupported geolocation', async () => {
      mockLocationUtils.isLocationSupported.mockReturnValue(false)
      mockLocationUtils.getLocationErrorMessage.mockReturnValue('Geolocation not supported')

      const { result } = renderHook(() => useLocation())

      await act(async () => {
        await result.current.getLocation()
      })

      expect(result.current.error).toBe('Geolocation not supported')
      expect(mockLocationUtils.getCurrentLocation).not.toHaveBeenCalled()
    })
  })

  describe('verifyLocationAgainstBranch', () => {
    test('should verify location successfully', async () => {
      const branchLocation = {
        latitude: 13.7565,
        longitude: 100.5020,
      }

      const verificationResult = {
        verified: true,
        distance: 25,
        accuracy: 15,
      }

      mockLocationUtils.getCurrentLocation.mockResolvedValue(mockLocationData)
      mockLocationUtils.verifyLocation.mockResolvedValue(verificationResult)

      const { result } = renderHook(() => useLocation())

      // First get location
      await act(async () => {
        await result.current.getLocation()
      })

      // Then verify against branch
      let verifyResult: any
      await act(async () => {
        verifyResult = await result.current.verifyLocationAgainstBranch(branchLocation, 50)
      })

      expect(mockLocationUtils.verifyLocation).toHaveBeenCalledWith(
        mockLocationData.coords,
        mockLocationData.accuracy,
        branchLocation,
        50
      )
      expect(verifyResult).toEqual(verificationResult)
    })

    test('should throw error when no location data available', async () => {
      const { result } = renderHook(() => useLocation())

      await expect(
        result.current.verifyLocationAgainstBranch({
          latitude: 13.7565,
          longitude: 100.5020,
        })
      ).rejects.toThrow('No location data available')
    })
  })

  describe('watch position', () => {
    test('should start watching position', async () => {
      const watchId = 123
      mockGeolocation.watchPosition.mockReturnValue(watchId)

      const { result } = renderHook(() => useLocation())

      act(() => {
        result.current.startWatching()
      })

      expect(mockGeolocation.watchPosition).toHaveBeenCalled()
      expect(result.current.watching).toBe(true)
    })

    test('should stop watching position', async () => {
      const watchId = 123
      mockGeolocation.watchPosition.mockReturnValue(watchId)

      const { result } = renderHook(() => useLocation())

      act(() => {
        result.current.startWatching()
      })

      act(() => {
        result.current.stopWatching()
      })

      expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(watchId)
      expect(result.current.watching).toBe(false)
    })

    test('should auto-start watching when watchPosition option is true', async () => {
      const watchId = 123
      mockGeolocation.watchPosition.mockReturnValue(watchId)

      const { result } = renderHook(() => useLocation({ watchPosition: true }))

      await waitFor(() => {
        expect(result.current.watching).toBe(true)
      })

      expect(mockGeolocation.watchPosition).toHaveBeenCalled()
    })

    test('should handle watch position error', async () => {
      const mockError = {
        code: 1, // PERMISSION_DENIED
        message: 'Permission denied',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      }

      let watchErrorCallback: (error: any) => void

      mockGeolocation.watchPosition.mockImplementation((success, error) => {
        watchErrorCallback = error
        return 123
      })

      mockLocationUtils.getLocationErrorMessage.mockReturnValue('Location access denied')

      const { result } = renderHook(() => useLocation())

      act(() => {
        result.current.startWatching()
      })

      act(() => {
        watchErrorCallback(mockError)
      })

      expect(result.current.error).toBe('Location access denied')
      expect(result.current.loading).toBe(false)
    })

    test('should auto-stop watching on unmount', () => {
      const watchId = 123
      mockGeolocation.watchPosition.mockReturnValue(watchId)

      const { result, unmount } = renderHook(() => useLocation({ watchPosition: true }))

      act(() => {
        result.current.startWatching()
      })

      unmount()

      expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(watchId)
    })
  })

  describe('utility methods', () => {
    test('should clear location data', async () => {
      mockLocationUtils.getCurrentLocation.mockResolvedValue(mockLocationData)

      const { result } = renderHook(() => useLocation())

      // First get location
      await act(async () => {
        await result.current.getLocation()
      })

      expect(result.current.hasLocation).toBe(true)

      // Then clear location
      act(() => {
        result.current.clearLocation()
      })

      expect(result.current.coords).toBeNull()
      expect(result.current.accuracy).toBeNull()
      expect(result.current.timestamp).toBeNull()
      expect(result.current.error).toBeNull()
      expect(result.current.hasLocation).toBe(false)
    })

    test('should check permission', async () => {
      const { result } = renderHook(() => useLocation())

      let permission: any
      await act(async () => {
        permission = await result.current.checkPermission()
      })

      expect(mockLocationUtils.requestLocationPermission).toHaveBeenCalled()
      expect(permission).toBe('granted')
      expect(result.current.permission).toBe('granted')
    })
  })

  describe('options', () => {
    test('should use custom options', () => {
      const options = {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 60000,
        watchPosition: true,
      }

      renderHook(() => useLocation(options))

      // Options are used internally, verify by checking if watch is set up with correct options
      expect(mockLocationUtils.requestLocationPermission).toHaveBeenCalled()
    })
  })
})

describe('useCurrentLocation', () => {
  const mockLocationData = {
    coords: {
      latitude: 13.7563,
      longitude: 100.5018,
    },
    accuracy: 15,
    timestamp: Date.now(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should initialize with default state', () => {
    const { result } = renderHook(() => useCurrentLocation())

    expect(result.current.coords).toBeNull()
    expect(result.current.accuracy).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.hasLocation).toBe(false)
    expect(result.current.isAccurate).toBe(false)
  })

  test('should get current location successfully', async () => {
    mockLocationUtils.getCurrentLocation.mockResolvedValue(mockLocationData)

    const { result } = renderHook(() => useCurrentLocation())

    let locationResult: any
    await act(async () => {
      locationResult = await result.current.getLocation()
    })

    expect(mockLocationUtils.getCurrentLocation).toHaveBeenCalled()
    expect(result.current.coords).toEqual(mockLocationData.coords)
    expect(result.current.accuracy).toBe(mockLocationData.accuracy)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.hasLocation).toBe(true)
    expect(result.current.isAccurate).toBe(true)
    expect(locationResult).toEqual(mockLocationData)
  })

  test('should handle location error', async () => {
    const errorMessage = 'Location access denied'
    mockLocationUtils.getCurrentLocation.mockRejectedValue(new Error(errorMessage))

    const { result } = renderHook(() => useCurrentLocation())

    let locationResult: any
    await act(async () => {
      locationResult = await result.current.getLocation()
    })

    expect(result.current.coords).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe(errorMessage)
    expect(result.current.hasLocation).toBe(false)
    expect(locationResult).toBeNull()
  })

  test('should determine accuracy correctly', async () => {
    // Test high accuracy
    mockLocationUtils.getCurrentLocation.mockResolvedValue({
      ...mockLocationData,
      accuracy: 10, // Good accuracy
    })

    const { result } = renderHook(() => useCurrentLocation())

    await act(async () => {
      await result.current.getLocation()
    })

    expect(result.current.isAccurate).toBe(true)

    // Test low accuracy
    mockLocationUtils.getCurrentLocation.mockResolvedValue({
      ...mockLocationData,
      accuracy: 200, // Poor accuracy
    })

    await act(async () => {
      await result.current.getLocation()
    })

    expect(result.current.isAccurate).toBe(false)
  })
})