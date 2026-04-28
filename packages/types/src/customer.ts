export interface Customer {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  createdAt: string
}

export interface Address {
  id: string
  customerId: string
  firstName: string
  lastName: string
  address1: string
  address2: string | null
  city: string
  province: string
  postalCode: string
  countryCode: string
  phone: string | null
}
