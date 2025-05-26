# API Documentation

## Account Service

### GET /account/:id
Description: Get account page
Parameters:
  - id (string): User encoded id
Response:
  - username (string): User's username
  - about (string): User's about section
  - youtube (string): User's YouTube link
  - tiktok (string): User's TikTok link
  - instagram (string): User's Instagram link
  - image (string): URL of user's profile image
  - banner (string): URL of user's banner image
  - urbexCount (number): Number of urbex locations explored by the user
  - friendCount (number): Number of friends the user has
  - friendStatus (boolean): Friendship status with the logged-in user
  - images (array): Array of image URLs from user's locations
  - isPrivate (boolean): Indicates if the user's account is private
Request Example: None
Response Example:
```json
{
  "username": "JohnDoe",
  "about": "Loves exploring abandoned places.",
  "youtube": "https://youtube.com/johndoe",
  "tiktok": "https://tiktok.com/@johndoe",
  "instagram": "https://instagram.com/johndoe",
  "image": "/uploads/images/profile.jpg",
  "banner": "/uploads/images/banner.jpg",
  "urbexCount": 15,
  "friendCount": 120,
  "friendStatus": true,
  "images": ["/uploads/locations/image1.jpg", "/uploads/locations/image2.jpg"],
  "isPrivate": false
}
```

### GET /account/
Description: Get user base info
Parameters:
  - None
Response:
  - id (string): Encrypted user ID
  - username (string): User's username
  - image (string): URL of user's profile image
  - isAdmin (boolean): Indicates if the user is an admin
Request Example: None
Response Example:
```json
{
  "id": "encryptedUserIdString",
  "username": "JohnDoe",
  "image": "/uploads/images/profile.jpg",
  "isAdmin": false
}
```

### GET /account/details
Description: Get user info
Parameters:
  - None
Response:
  - email (string): User's email address
  - username (string): User's username
  - about (string): User's about section
  - youtube (string): User's YouTube link
  - tiktok (string): User's TikTok link
  - instagram (string): User's Instagram link
  - image (string): URL of user's profile image
  - banner (string): URL of user's banner image
Request Example: None
Response Example:
```json
{
  "email": "johndoe@example.com",
  "username": "JohnDoe",
  "about": "Loves exploring abandoned places.",
  "youtube": "https://youtube.com/johndoe",
  "tiktok": "https://tiktok.com/@johndoe",
  "instagram": "https://instagram.com/johndoe",
  "image": "/uploads/images/profile.jpg",
  "banner": "/uploads/images/banner.jpg"
}
```

### PUT /account/
Description: Edit profile
Parameters:
  - about (string): About section content (formData)
  - youtube (string): YouTube link (formData)
  - tiktok (string): TikTok link (formData)
  - instagram (string): Instagram link (formData)
  - isPrivate (boolean): Is private flag (formData)
  - image (File): Optional - Profile image (formData)
  - banner (File): Optional - Banner image (formData)
Response:
  - {} (object): Empty object
Request Example (formData):
  - about (string): "Updated about section."
  - youtube (string): "https://youtube.com/newjohndoe"
  - tiktok (string): "https://tiktok.com/@newjohndoe"
  - instagram (string): "https://instagram.com/newjohndoe"
  - isPrivate (boolean): true
  - image (File): (binary file data for image)
  - banner (File): (binary file data for banner)
Response Example:
```json
{}
```

### PUT /account/password
Description: Edit password
Parameters:
  - password (string): Current password (body)
  - newPassword (string): New password (body)
Response:
  - {} (object): Empty object
Request Example:
```json
{
  "password": "currentSecurePassword",
  "newPassword": "newSecurePassword"
}
```
Response Example:
```json
{}
```

## Authentication Service

### POST /auth/login
Description: User login
Parameters:
  - email (string): Email (body)
  - password (string): Password (body)
  - keepMeLoggedIn (boolean): Stay connected (body)
Response:
  - token (string): JWT token
Request Example:
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "keepMeLoggedIn": true
}
```
Response Example:
```json
{
  "token": "jwt.token.string"
}
```

### POST /auth/register
Description: User register
Parameters:
  - email (string): Email (body)
  - password (string): Password (body)
  - username (string): Username (body)
Response:
  - token (string): JWT token
Request Example:
```json
{
  "email": "newuser@example.com",
  "password": "newSecurePassword123",
  "username": "NewUser"
}
```
Response Example:
```json
{
  "token": "jwt.token.string"
}
```

### POST /auth/password/forgot
Description: Send password reset email
Parameters:
  - email (string): Email (body)
Response:
  - {} (object): Empty object
Request Example:
```json
{
  "email": "user@example.com"
}
```
Response Example:
```json
{}
```

### POST /auth/password/reset
Description: Reset user password
Parameters:
  - token (string): Token (body)
  - password (string): Password (body)
Response:
  - {} (object): Empty object
Request Example:
```json
{
  "token": "reset.token.string",
  "password": "newSecurePassword456"
}
```
Response Example:
```json
{}
```

## Favorite Service

### GET /favorite/:id
Description: Get a favorite with it's location
Parameters:
  - id (string): Favorite encoded id (route)
Response:
  - name (string): Favorite name
  - count (number): Number of locations in the favorite
  - list (Location[]): Array of locations in the favorite
Request Example: None
Response Example:
```json
{
  "name": "My Favorite Spots",
  "count": 2,
  "list": [
    {
      "id": "encryptedLocationId1",
      "name": "Abandoned Factory",
      "lat": 40.7128,
      "lon": -74.0060,
      "categoryId": 1,
      "image": "/uploads/locations/factory.jpg"
    },
    {
      "id": "encryptedLocationId2",
      "name": "Old Hospital",
      "lat": 34.0522,
      "lon": -118.2437,
      "categoryId": 2,
      "image": "/uploads/locations/hospital.jpg"
    }
  ]
}
```

### GET /favorite/summary
Description: Get user favorites summary
Parameters:
  - None
Response:
  - Favorite[] (array): Array of user favorites
Request Example: None
Response Example:
```json
[
  {
    "id": "encryptedFavoriteId1",
    "name": "Urban Exploration",
    "count": 5,
    "active": true,
    "share": false,
    "userId": "encryptedUserId"
  },
  {
    "id": "encryptedFavoriteId2",
    "name": "Hidden Gems",
    "count": 3,
    "active": true,
    "share": true,
    "userId": "encryptedUserId"
  }
]
```

### GET /favorite
Description: Get user favorites
Parameters:
  - None
Response:
  - Favorite[] (array): Array of user favorites with user details
Request Example: None
Response Example:
```json
[
  {
    "id": "encryptedFavoriteId1",
    "name": "Urban Exploration",
    "count": 5,
    "active": true,
    "share": false,
    "user": {
      "id": "encryptedUserId",
      "username": "Explorer123",
      "image": "/uploads/users/avatar1.jpg"
    }
  },
  {
    "id": "encryptedFavoriteId2",
    "name": "Hidden Gems",
    "count": 3,
    "active": true,
    "share": true,
    "user": {
      "id": "encryptedUserId",
      "username": "Explorer123",
      "image": "/uploads/users/avatar1.jpg"
    }
  }
]
```

### POST /favorite
Description: Create favorite with location (optional)
Parameters:
  - name (string): Favorite name (body)
  - locationId (string): Optional - Location encoded id (body)
Response:
  - id (string): Encrypted favorite ID
Request Example:
```json
{
  "name": "Weekend Adventures",
  "locationId": "encryptedLocationId3"
}
```
Response Example:
```json
{
  "id": "newEncryptedFavoriteId"
}
```

### PUT /favorite/:id/location/:locationId
Description: Toggle favorite location
Parameters:
  - id (string): Favorite encoded id (route)
  - locationId (string): Location encoded id (route)
Response:
  - {} (object): Empty object
Request Example: None
Response Example:
```json
{}
```

### DELETE /favorite/:id
Description: Delete favorite
Parameters:
  - id (string): Favorite encoded id (route)
Response:
  - {} (object): Empty object
Request Example: None
Response Example:
```json
{}
```

### PUT /favorite/:id/disable
Description: Toggle favorite from summary
Parameters:
  - id (string): Favorite encoded id (route)
Response:
  - {} (object): Empty object
Request Example: None
Response Example:
```json
{}
```

### PUT /favorite/:id/share
Description: Toggle favorite share
Parameters:
  - id (string): Favorite encoded id (route)
Response:
  - {} (object): Empty object
Request Example: None
Response Example:
```json
{}
```

### GET /favorite/:id/search
Description: Search for users who are not in favorite
Parameters:
  - id (string): Favorite encoded id (route)
  - string (string): Optional - Search string (query)
Response:
  - User[] (array): Array of users
Request Example: None
Response Example:
```json
[
  {
    "id": "encryptedUserId2",
    "username": "JaneDoe",
    "image": "/uploads/users/avatar2.jpg"
  },
  {
    "id": "encryptedUserId3",
    "username": "UrbanExplorer",
    "image": "/uploads/users/avatar3.jpg"
  }
]
```

### PUT /favorite/:id/user/:userId
Description: Add user to favorite
Parameters:
  - id (string): Favorite encoded id (route)
  - userId (string): User encoded id (route)
Response:
  - {} (object): Empty object
Request Example: None
Response Example:
```json
{}
```

## Friend Service

### GET /friend
Description: Get friends, pending friends and waiting approval friends
Parameters:
  - None
Response:
  - pending (Friend[]): Array of pending friend requests
  - waiting (Friend[]): Array of friend requests waiting for user's approval
  - friends (Friend[]): Array of user's friends
Request Example: None
Response Example:
```json
{
  "pending": [
    {
      "id": "encryptedUserId4",
      "username": "PendingFriend1",
      "image": "/uploads/users/avatar4.jpg"
    }
  ],
  "waiting": [
    {
      "id": "encryptedUserId5",
      "username": "WaitingFriend1",
      "image": "/uploads/users/avatar5.jpg"
    }
  ],
  "friends": [
    {
      "id": "encryptedUserId6",
      "username": "Friend1",
      "image": "/uploads/users/avatar6.jpg"
    }
  ]
}
```

### GET /friend/search
Description: Search for users who are not friends
Parameters:
  - string (string): Optional - Search string (query)
Response:
  - Friend[] (array): Array of users matching the search string
Request Example: None
Response Example:
```json
[
  {
    "id": "encryptedUserId7",
    "username": "SearchedUser1",
    "image": "/uploads/users/avatar7.jpg"
  },
  {
    "id": "encryptedUserId8",
    "username": "AnotherUser",
    "image": "/uploads/users/avatar8.jpg"
  }
]
```

### POST /friend/:id
Description: Make friend request
Parameters:
  - id (string): User id (route)
Response:
  - friend (boolean): True if the request resulted in a new friendship, false otherwise
Request Example: None
Response Example:
```json
{
  "friend": false
}
```

### DELETE /friend/:id
Description: Delete friend
Parameters:
  - id (string): User id (route)
Response:
  - {} (object): Empty object
Request Example: None
Response Example:
```json
{}
```

### PUT /friend/:id/cancel
Description: Cancel friend request
Parameters:
  - id (string): User id (route)
Response:
  - {} (object): Empty object
Request Example: None
Response Example:
```json
{}
```

### PUT /friend/:id/accept
Description: Accept friend request
Parameters:
  - id (string): User id (route)
Response:
  - {} (object): Empty object
Request Example: None
Response Example:
```json
{}
```

### PUT /friend/:id/decline
Description: Decline friend request
Parameters:
  - id (string): User id (route)
Response:
  - {} (object): Empty object
Request Example: None
Response Example:
```json
{}
```

## Location Service

### GET /location/:id
Description: Get a location
Parameters:
  - id (string): Location encoded id (route)
Response:
  - Location (object): Location object
Request Example: None
Response Example:
```json
{
  "id": "encryptedLocationId",
  "name": "Abandoned Power Plant",
  "description": "A large power plant closed in the 90s.",
  "lat": 45.12345,
  "lon": -75.67890,
  "categoryId": 3,
  "countryId": 1,
  "userId": "encryptedUserId",
  "image": "/uploads/locations/powerplant.jpg",
  "createdAt": "2023-01-15T10:00:00.000Z",
  "updatedAt": "2023-01-16T12:00:00.000Z",
  "source": "manual",
  "category": {
    "id": 3,
    "name": "Industrial"
  },
  "user": {
    "id": "encryptedUserId",
    "username": "LocationAdder",
    "image": "/uploads/users/avatar_adder.jpg"
  },
  "country": {
    "id": 1,
    "name": "United States"
  }
}
```

### GET /location/filter
Description: Get all filters for search
Parameters:
  - None
Response:
  - categories (object): Object of category IDs to names
  - countries (object): Object of country IDs to names
  - sources (object): Optional - Object of source names to names (for super users)
Request Example: None
Response Example:
```json
{
  "categories": {
    "1": "Residential",
    "2": "Hospital",
    "3": "Industrial"
  },
  "countries": {
    "1": "United States",
    "2": "Canada",
    "3": "France"
  },
  "sources": {
    "manual": "manual",
    "gpx": "gpx"
  }
}
```

### POST /location/p/:page
Description: Get location list by page
Parameters:
  - page (number): Location page number (route)
  - string (string): Optional - Search string (body)
  - categories (number[]): Optional - Categories ids (body)
  - countries (number[]): Optional - Countries ids (body)
  - sources (string[]): Optional - Sources names (body)
Response:
  - count (number): Total number of locations
  - list (Location[]): Array of locations
Request Example:
```json
{
  "string": "factory",
  "categories": [3],
  "countries": [1],
  "sources": ["manual"]
}
```
Response Example:
```json
{
  "count": 1,
  "list": [
    {
      "id": "encryptedLocationId1",
      "name": "Abandoned Factory",
      "lat": 40.7128,
      "lon": -74.0060,
      "categoryId": 3,
      "image": "/uploads/locations/factory.jpg",
      "countryId": 1,
      "userId": "encryptedUserId",
      "createdAt": "2023-02-20T10:00:00.000Z",
      "updatedAt": "2023-02-20T10:00:00.000Z",
      "source": "manual"
    }
  ]
}
```

### POST /location/map
Description: Get map locations
Parameters:
  - string (string): Optional - Search string (body)
  - categories (number[]): Optional - Categories ids (body)
  - countries (number[]): Optional - Countries ids (body)
  - sources (string[]): Optional - Sources names (body)
Response:
  - count (number): Total number of locations
  - list (Location[]): Array of locations
Request Example:
```json
{
  "categories": [1, 2],
  "countries": [2]
}
```
Response Example:
```json
{
  "count": 1,
  "list": [
    {
      "id": "encryptedLocationId9",
      "name": "Old Mansion",
      "lat": 48.8566,
      "lon": 2.3522,
      "categoryId": 1,
      "image": "/uploads/locations/mansion.jpg",
      "countryId": 2,
      "userId": "encryptedUserId",
      "createdAt": "2023-03-10T15:00:00.000Z",
      "updatedAt": "2023-03-10T15:00:00.000Z",
      "source": "manual"
    }
  ]
}
```

### GET /location
Description: Get user locations
Parameters:
  - None
Response:
  - count (number): Total number of locations
  - list (Location[]): Array of locations
Request Example: None
Response Example:
```json
{
  "count": 1,
  "list": [
    {
      "id": "encryptedUserLocationId1",
      "name": "My Secret Spot",
      "lat": 35.6895,
      "lon": 139.6917,
      "categoryId": 5,
      "image": "/uploads/locations/secret.jpg",
      "countryId": 4,
      "userId": "currentUserEncryptedId",
      "createdAt": "2023-04-01T08:00:00.000Z",
      "updatedAt": "2023-04-01T08:00:00.000Z",
      "source": "manual"
    }
  ]
}
```

### POST /location
Description: Add location
Parameters:
  - name (string): Name (formData)
  - description (string): Description (formData)
  - lat (number): Latitude (formData)
  - lon (number): Longitude (formData)
  - categoryId (number): Category id (formData)
  - image (File): Optional - Image (formData)
Response:
  - {} (object): Empty object
Request Example (formData):
  - name (string): "New Discovered Place"
  - description (string): "A very interesting place found recently."
  - lat (number): 34.052235
  - lon (number): -118.243683
  - categoryId (number): 2
  - image (File): (binary file data)
Response Example:
```json
{}
```

### PUT /location/:id
Description: Edit location
Parameters:
  - id (string): Location encoded id (route)
  - name (string): Name (formData)
  - description (string): Description (formData)
  - lat (number): Latitude (formData)
  - lon (number): Longitude (formData)
  - categoryId (number): Category Id (formData)
  - image (File): Optional - Image (formData)
Response:
  - {} (object): Empty object
Request Example (formData):
  - name (string): "Updated Place Name"
  - description (string): "Updated description of this place."
  - lat (number): 34.052235
  - lon (number): -118.243683
  - categoryId (number): 3
  - image (File): (binary file data for new image)
Response Example:
```json
{}
```

### DELETE /location/:id
Description: Delete location
Parameters:
  - id (string): Location encoded id (route)
Response:
  - {} (object): Empty object
Request Example: None
Response Example:
```json
{}
```

## User Service

### GET /user
Description: Get all users (admin only)
Parameters:
  - None
Response:
  - User[] (array): Array of user objects, each containing id, username, image, and roles
Request Example: None
Response Example:
```json
[
  {
    "id": "encryptedAdminUserId",
    "username": "AdminUser",
    "image": "/uploads/users/admin_avatar.jpg",
    "roles": ["admin", "user"]
  },
  {
    "id": "encryptedRegularUserId",
    "username": "RegularUser",
    "image": "/uploads/users/user_avatar.jpg",
    "roles": ["user"]
  }
]
```

### PUT /user/:id/roles
Description: Update user roles (admin only)
Parameters:
  - id (string): User encoded id (route)
  - roles (string[]): Array of role names (body)
Response:
  - message (string): Success message
Request Example:
```json
{
  "roles": ["user", "editor"]
}
```
Response Example:
```json
{
  "message": "User roles updated successfully"
}
```

### DELETE /user/:id
Description: Delete a user (admin only)
Parameters:
  - id (string): User encoded id (route)
Response:
  - message (string): Success message
Request Example: None
Response Example:
```json
{
  "message": "User deleted successfully"
}
```
