/** The left base's money. The rival base does not bank ore. */
export class Bank {
  private money: number

  private constructor(money: number) {
    this.money = money
  }

  static start(amount: number): Bank {
    return new Bank(amount)
  }

  static restore(amount: number): Bank {
    return new Bank(amount)
  }

  deposit(amount: number): void {
    this.money += amount
  }

  spend(amount: number): boolean {
    if (this.money < amount) return false
    this.money -= amount
    return true
  }

  get amount(): number {
    return this.money
  }
}
