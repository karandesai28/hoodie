###
to be fixed ...

describe "Hoodie.Share.Instance", ->  
  beforeEach ->
    @hoodie  = new Mocks.Hoodie 
    Hoodie.Share.Instance.hoodie = @hoodie
    @share = new Hoodie.Share.Instance
  
  describe "constructor", ->
    beforeEach ->
      spyOn(@hoodie.my.localStore, "uuid").andReturn 'newId'
      spyOn(Hoodie.Share.Instance::, "set")
      spyOn(Hoodie.Share.Instance::, "add")
      
    it "should set the attributes", ->
      share = new Hoodie.Share.Instance {funky: 'options'}
      expect(Hoodie.Share.Instance::set).wasCalledWith {funky: 'options'}
    
    
    _when "user is anonymous", ->
      beforeEach ->
        @hoodie.my.account.username = undefined
      
      it "should use the ShareHoodie", ->
        share = new Hoodie.Share.Instance
        expect(share.hoodie.constructor).toBe ShareHoodie
        
      it "should set anonymous to true", ->
        share = new Hoodie.Share.Instance
        expect(share.anonymous).toBeTruthy()
      
        
    _when "user has an account", ->
      beforeEach ->
        @hoodie.my.account.username = 'joe@example.com'
      
      it "should use the ShareHoodie", ->
        share = new Hoodie.Share.Instance
        expect(share.hoodie.constructor).toBe HoodieMock
        
      it "should set anonymous to false", ->
        share = new Hoodie.Share.Instance
        expect(share.anonymous).toBeFalsy()
    
  # /constructor
###