# File: person.ts
// Defines an interface for a person.

interface Person {
  firstName: string;
  lastName: string;
  age: number;
}

class PersonImpl implements Person {
  firstName: string;
  lastName: string;
  age: number;

  constructor(firstName: string, lastName: string, age: number) {
    this.firstName = firstName;
    this.lastName = lastName;
    this.age = age;
  }

  getFullname(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}

export default PersonImpl;