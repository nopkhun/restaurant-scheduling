import {
  calculateDistance,
  getCurrentLocation,
  verifyLocation,
  detectSuspiciousMovement,
  formatLocation,
  isLocationSupported,
  requestLocationPermission,
  getLocationErrorMessage,
  LocationError,
  LocationCoords,
} from '../utils'

// Mock navigator.geolocation
const mockGeolocation = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
}

// Mock navigator.permissions
const mockPermissions = {
  query: jest.fn(),
}

Object.defineProperty(global.navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
})

Object.defineProperty(global.navigator, 'permissions', {
  value: mockPermissions,
  writable: true,
})

// Mock fetch for IP geolocation
global.fetch = jest.fn()

describe('Location Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('calculateDistance', () => {
    test('should calculate distance between two points correctly', () => {
      // Bangkok to Chiang Mai (approx 587 km)
      const bangkokLat = 13.7563
      const bangkokLng = 100.5018
      const chiangMaiLat = 18.7883
      const chiangMaiLng = 98.9853

      const distance = calculateDistance(bangkokLat, bangkokLng, chiangMaiLat, chiangMaiLng)
      
      // Should be approximately 587,000 meters (allow 10km variance)
      expect(distance).toBeGreaterThan(577000)
      expect(distance).toBeLessThan(597000)
    })

    test('should return 0 for same coordinates', () => {
      const distance = calculateDistance(13.7563, 100.5018, 13.7563, 100.5018)
      expect(distance).toBe(0)
    })

    test('should handle small distances accurately', () => {
      // Two points very close together (about 100 meters apart)
      const lat1 = 13.7563
      const lng1 = 100.5018
      const lat2 = 13.7572 // About 100m north
      const lng2 = 100.5018

      const distance = calculateDistance(lat1, lng1, lat2, lng2)
      expect(distance).toBeGreaterThan(90)
      expect(distance).toBeLessThan(110)
    })

    test('should handle negative coordinates', () => {
      const distance = calculateDistance(-13.7563, -100.5018, -13.7572, -100.5018)
      expect(distance).toBeGreaterThan(90)
      expect(distance).toBeLessThan(110)
    })
  })

  describe('getCurrentLocation', () => {
    test('should resolve with location data on success', async () => {
      const mockPosition = {
        coords: {
          latitude: 13.7563,
          longitude: 100.5018,
          accuracy: 10,
        },
        timestamp: Date.now(),
      }

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition)
      })

      const result = await getCurrentLocation()

      expect(result.coords.latitude).toBe(13.7563)
      expect(result.coords.longitude).toBe(100.5018)
      expect(result.accuracy).toBe(10)
      expect(result.timestamp).toBe(mockPosition.timestamp)
    })

    test('should reject when geolocation is not supported', async () => {
      Object.defineProperty(global.navigator, 'geolocation', {
        value: undefined,
        writable: true,
      })

      await expect(getCurrentLocation()).rejects.toThrow(
        'Geolocation is not supported by this browser'
      )
    })

    test('should reject with proper error message on permission denied', async () => {
      const mockError = {
        code: 1, // PERMISSION_DENIED
        message: 'User denied geolocation',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      }

      mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
        error(mockError)
      })

      await expect(getCurrentLocation()).rejects.toThrow('Location access denied by user')
    })

    test('should reject with timeout error', async () => {
      const mockError = {
        code: 3, // TIMEOUT
        message: 'Timeout',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      }

      mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
        error(mockError)
      })

      await expect(getCurrentLocation()).rejects.toThrow('Location request timed out')
    })
  })

  describe('verifyLocation', () => {
    const branchLocation: LocationCoords = {
      latitude: 13.7563,
      longitude: 100.5018,
    }

    beforeEach(() => {
      // Mock successful IP geolocation
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          latitude: '13.7500',
          longitude: '100.5000',
          city: 'Bangkok',
          country_name: 'Thailand',
        }),
      })
    })

    test('should verify location within radius', async () => {
      const userLocation: LocationCoords = {
        latitude: 13.7565, // Very close to branch
        longitude: 100.5020,
      }

      const result = await verifyLocation(userLocation, 15, branchLocation, 50)

      expect(result.verified).toBe(true)
      expect(result.distance).toBeLessThan(50)
      expect(result.accuracy).toBe(15)
    })

    test('should fail verification when outside radius', async () => {
      const userLocation: LocationCoords = {
        latitude: 13.8000, // Far from branch
        longitude: 100.6000,
      }

      const result = await verifyLocation(userLocation, 15, branchLocation, 50)

      expect(result.verified).toBe(false)
      expect(result.reason).toBe('OUTSIDE_LOCATION_RADIUS')
      expect(result.distance).toBeGreaterThan(50)
    })

    test('should fail verification when GPS accuracy is too low', async () => {
      const userLocation: LocationCoords = {
        latitude: 13.7565,
        longitude: 100.5020,
      }

      const result = await verifyLocation(userLocation, 500, branchLocation, 50)

      expect(result.verified).toBe(false)
      expect(result.reason).toBe('GPS_ACCURACY_TOO_LOW')
      expect(result.accuracy).toBe(500)
    })

    test('should fail verification on IP location mismatch', async () => {
      // Mock IP geolocation returning distant location
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          latitude: '18.7883', // Chiang Mai
          longitude: '98.9853',
          city: 'Chiang Mai',
          country_name: 'Thailand',
        }),
      })

      const userLocation: LocationCoords = {
        latitude: 13.7565,
        longitude: 100.5020,
      }

      const result = await verifyLocation(userLocation, 15, branchLocation, 50)

      expect(result.verified).toBe(false)
      expect(result.reason).toBe('IP_LOCATION_MISMATCH')
    })

    test('should handle IP geolocation failure gracefully', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      const userLocation: LocationCoords = {
        latitude: 13.7565,
        longitude: 100.5020,
      }

      const result = await verifyLocation(userLocation, 15, branchLocation, 50)

      expect(result.verified).toBe(true) // Should still pass without IP check
    })
  })

  describe('detectSuspiciousMovement', () => {
    test('should detect normal movement speed', () => {
      const previousLocation = {
        latitude: 13.7563,
        longitude: 100.5018,
        timestamp: Date.now() - 60000, // 1 minute ago
      }

      const currentLocation = {
        latitude: 13.7573, // About 100m away
        longitude: 100.5018,
        timestamp: Date.now(),
      }

      const isSuspicious = detectSuspiciousMovement(previousLocation, currentLocation)
      expect(isSuspicious).toBe(false)
    })

    test('should detect suspicious high-speed movement', () => {
      const previousLocation = {
        latitude: 13.7563,
        longitude: 100.5018,
        timestamp: Date.now() - 60000, // 1 minute ago
      }

      const currentLocation = {
        latitude: 14.0000, // Very far away (about 27km)
        longitude: 100.5018,
        timestamp: Date.now(),
      }

      const isSuspicious = detectSuspiciousMovement(previousLocation, currentLocation)
      expect(isSuspicious).toBe(true)
    })

    test('should handle zero time difference', () => {
      const timestamp = Date.now()
      const previousLocation = {
        latitude: 13.7563,
        longitude: 100.5018,
        timestamp,
      }

      const currentLocation = {
        latitude: 14.0000,
        longitude: 100.5018,
        timestamp, // Same timestamp
      }

      const isSuspicious = detectSuspiciousMovement(previousLocation, currentLocation)
      expect(isSuspicious).toBe(true) // Division by zero should be handled
    })
  })

  describe('formatLocation', () => {
    test('should format location without accuracy', () => {
      const location: LocationCoords = {
        latitude: 13.756789,
        longitude: 100.501834,
      }

      const formatted = formatLocation(location)
      expect(formatted).toBe('13.756789, 100.501834')
    })

    test('should format location with accuracy', () => {
      const location: LocationCoords = {
        latitude: 13.756789,
        longitude: 100.501834,
      }

      const formatted = formatLocation(location, 15.7)
      expect(formatted).toBe('13.756789, 100.501834 (±16m)')
    })

    test('should handle negative coordinates', () => {
      const location: LocationCoords = {
        latitude: -13.756789,
        longitude: -100.501834,
      }

      const formatted = formatLocation(location)
      expect(formatted).toBe('-13.756789, -100.501834')
    })
  })

  describe('isLocationSupported', () => {
    test('should return true when geolocation is supported', () => {
      expect(isLocationSupported()).toBe(true)
    })

    test('should return false when geolocation is not supported', () => {
      Object.defineProperty(global.navigator, 'geolocation', {
        value: undefined,
        writable: true,
      })

      expect(isLocationSupported()).toBe(false)
    })
  })

  describe('requestLocationPermission', () => {
    test('should return permission state when permissions API is available', async () => {
      mockPermissions.query.mockResolvedValue({ state: 'granted' })

      const permission = await requestLocationPermission()
      expect(permission).toBe('granted')
    })

    test('should fallback to testing location access when permissions API unavailable', async () => {
      Object.defineProperty(global.navigator, 'permissions', {
        value: undefined,
        writable: true,
      })

      const mockPosition = {
        coords: { latitude: 13.7563, longitude: 100.5018, accuracy: 10 },
        timestamp: Date.now(),
      }

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition)
      })

      const permission = await requestLocationPermission()
      expect(permission).toBe('granted')
    })

    test('should detect denied permission from error', async () => {
      Object.defineProperty(global.navigator, 'permissions', {
        value: undefined,
        writable: true,
      })

      mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
        error({ code: 1, message: 'Location access denied by user' })
      })

      const permission = await requestLocationPermission()
      expect(permission).toBe('denied')
    })
  })

  describe('getLocationErrorMessage', () => {
    test('should return correct message for each error type', () => {
      expect(getLocationErrorMessage(LocationError.PERMISSION_DENIED)).toContain('denied')
      expect(getLocationErrorMessage(LocationError.POSITION_UNAVAILABLE)).toContain('Unable to determine')
      expect(getLocationErrorMessage(LocationError.TIMEOUT)).toContain('timed out')
      expect(getLocationErrorMessage(LocationError.NOT_SUPPORTED)).toContain('not supported')
      expect(getLocationErrorMessage(LocationError.ACCURACY_TOO_LOW)).toContain('accuracy is too low')
      expect(getLocationErrorMessage(LocationError.OUTSIDE_RADIUS)).toContain('not within')
      expect(getLocationErrorMessage(LocationError.IP_MISMATCH)).toContain('verification failed')
    })

    test('should return default message for unknown error', () => {
      const message = getLocationErrorMessage('UNKNOWN_ERROR' as LocationError)
      expect(message).toContain('unknown')
    })
  })
})