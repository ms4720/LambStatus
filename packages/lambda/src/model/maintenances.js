import ComponentsStore from 'db/components'
import MaintenancesStore from 'db/maintenances'
import MaintenanceUpdatesStore from 'db/maintenanceUpdates'
import { Component } from 'model/components'
import generateID from 'utils/generateID'
import { maintenanceStatuses } from 'utils/const'
import { isValidDate } from 'utils/datetime'
import { NotFoundError, ValidationError } from 'utils/errors'

export class Maintenance {
  constructor ({maintenanceID, name, status, startAt, endAt, message = '', components = [],
                updatedAt = new Date().toISOString()}) {
    if (maintenanceID === undefined) {
      this.maintenanceID = generateID()
      this.needIDValidation = false
    } else {
      // If the user specifies the maintenance ID, the ID must be already existed.
      this.maintenanceID = maintenanceID
      this.needIDValidation = true
    }
    this.name = name
    this.status = status
    this.startAt = startAt
    this.endAt = endAt
    this.message = message
    this.components = components.map(comp => new Component(comp))
    this.updatedAt = updatedAt
  }

  async validate () {
    if (this.maintenanceID === undefined || this.maintenanceID === '') {
      throw new ValidationError('invalid maintenanceID parameter')
    }

    if (this.needIDValidation) {
      const maintenances = new Maintenances()
      await maintenances.lookup(this.maintenanceID)
    }

    if (this.name === undefined || this.name === '') {
      throw new ValidationError('invalid name parameter')
    }

    if (maintenanceStatuses.indexOf(this.status) < 0) {
      throw new ValidationError('invalid maintenance status parameter')
    }

    if (!isValidDate(this.startAt)) {
      throw new ValidationError('invalid startAt parameter')
    }

    if (!isValidDate(this.endAt)) {
      throw new ValidationError('invalid endAt parameter')
    }

    if (this.startAt > this.endAt) {
      throw new ValidationError('startAt is later than endAt')
    }

    if (this.message === undefined) {
      throw new ValidationError('invalid message parameter')
    }

    if (this.components === undefined || !Array.isArray(this.components)) {
      throw new ValidationError('invalid components parameter')
    }

    await Promise.all(this.components.map(async comp => {
      await comp.validate()
    }))

    if (!isValidDate(this.updatedAt)) {
      throw new ValidationError('invalid updatedAt parameter')
    }
  }

  async getMaintenanceUpdates () {
    const maintenanceUpdatesStore = new MaintenanceUpdatesStore()
    return await maintenanceUpdatesStore.getByMaintenanceID(this.maintenanceID)
  }

  async save () {
    // TODO: retry
    const maintenancesStore = new MaintenancesStore()
    await maintenancesStore.update(this.objectify())

    const maintenanceUpdatesStore = new MaintenanceUpdatesStore()
    await maintenanceUpdatesStore.update(this.objectify())

    const componentsStore = new ComponentsStore()
    await Promise.all(this.components.map(async (component) => {
      await componentsStore.updateStatus(component.componentID, component.status)
    }))
  }

  async delete () {
    const maintenancesStore = new MaintenancesStore()
    await maintenancesStore.delete(this.maintenanceID)

    const maintenanceUpdates = await this.getMaintenanceUpdates()
    const maintenanceUpdateIDs = maintenanceUpdates.map(maintenanceUpdate => maintenanceUpdate.maintenanceUpdateID)
    const maintenanceUpdatesStore = new MaintenancesStore()
    await maintenanceUpdatesStore.delete(this.maintenanceID, maintenanceUpdateIDs)
  }

  objectify () {
    return {
      maintenanceID: this.maintenanceID,
      name: this.name,
      status: this.status,
      startAt: this.startAt,
      endAt: this.endAt,
      message: this.message,
      components: this.components.map(comp => { return comp.objectify() }),
      updatedAt: this.updatedAt
    }
  }
}

export class Maintenances {
  async all () {
    const store = new MaintenancesStore()
    const maintenances = await store.getAll()
    return maintenances.map(maintenance => new Maintenance(maintenance))
  }

  async lookup (maintenanceID) {
    const store = new MaintenancesStore()
    const maintenances = await store.getByID(maintenanceID)
    if (maintenances.length === 0) {
      throw new NotFoundError('no matched item')
    } else if (maintenances.length === 1) {
      const maintenance = maintenances[0]
      return new Maintenance(maintenance)
    } else {
      throw new Error('matched too many items')
    }
  }
}
